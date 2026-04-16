import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Sparkles, Check, X, ChevronDown, ChevronUp, Pencil, Download, CheckCircle2, Undo2, ChevronsUpDown, ChevronsDownUp, AlertTriangle, ArrowUp } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { AccountSelector } from '@/components/shared/AccountSelector';
import { MultiSelect } from '@/components/shared/MultiSelect';
import { useAdAccounts, getMissingAccountFields } from '@/hooks/useAdAccounts';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { bulkEditAds } from '@/lib/openaiClient';
import { buildCreativeUpdate } from '@/lib/metaCreativeUpdate';
import { metaPost, metaGet } from '@/lib/metaApi';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * Meta ads can have multiple bodies, titles, and descriptions via asset_feed_spec.
 * Each text variant is stored as an array item so AI bulk edit processes all variants.
 */
interface Ad {
  id: string;
  name: string;
  headlines: string[];       // titles array from asset_feed_spec
  bodies: string[];          // bodies array from asset_feed_spec
  descriptions: string[];    // descriptions array from asset_feed_spec
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  adType: 'IMAGE' | 'VIDEO' | 'CAROUSEL';
  campaignId: string | null;
  campaignName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  // Per-ad delivery schedule from Meta (ISO-8601 with offset). Display-only;
  // AI Bulk Edit's push-to-Meta flow only rebinds creative, so these fields
  // survive untouched on the ad itself.
  scheduleStart: string | null;
  scheduleEnd: string | null;
  selected: boolean;
  modified: boolean;         // true after accepting AI suggestions (pending push to Meta)
  aiSuggestion?: string;     // JSON of { headlines: string[], bodies: string[], descriptions: string[] }
  aiAnalyzedAt?: number;     // timestamp of last AI run that included this ad — drives the post-AI sort
}

interface MetaFetchAdsResponse {
  ads: Array<{
    id: string;
    name: string;
    status: string;
    ad_type: string;
    campaign_id?: string | null;
    campaign_name?: string | null;
    adset_id?: string | null;
    adset_name?: string | null;
    ad_schedule_start_time?: string | null;
    ad_schedule_end_time?: string | null;
    headlines: string[];
    bodies: string[];
    descriptions: string[];
  }>;
}

/**
 * Quirky rotating quotes shown while the AI is processing. Cycles every 3s.
 * Keep them short, on-brand for ad ops, and a little funny.
 */
const aiQuotes = [
  "AI is breaking a sweat to make your request happen…",
  "Teaching the model to read between your headlines…",
  "Whispering your instruction to every ad in unison…",
  "Brewing fresh ad copy with extra serotonin…",
  "Convincing the AI that 'catchy' isn't subjective…",
  "Negotiating with words for a better conversion rate…",
  "Auditing every comma for vibes…",
  "The AI is rolling up its sleeves…",
  "Sprinkling a little magic on each variant…",
  "Asking the model to channel its inner copywriter…",
  "Polishing each headline like a small gemstone…",
  "Translating your wishes into clickable English…",
  "Hand-rolling new copy, one ad at a time…",
  "The model is consulting its thesaurus…",
  "Dispatching verbs to where they're needed most…",
];

/**
 * Sort group for the post-AI ad ordering. Lower number = higher in the list.
 *   0 → modified by THIS ai run (top, user needs to review)
 *   1 → never analyzed by an ai run (middle, user hasn't decided to involve them)
 *   2 → analyzed by THIS ai run with no applicable changes (bottom, can be ignored)
 *
 * The "this run" check uses the analyzedAt timestamp so a previous run's
 * unchanged ads don't get pushed to the bottom forever — only the most recent
 * run's verdicts shape the sort.
 */
function groupForSort(
  ad: Ad,
  analyzedAt: number,
  result: { modifiedAdIds: Set<string>; unchangedAdIds: Set<string> },
): number {
  const wasAnalyzedThisRun = ad.aiAnalyzedAt === analyzedAt;
  if (!wasAnalyzedThisRun) return 1;
  if (result.modifiedAdIds.has(ad.id)) return 0;
  if (result.unchangedAdIds.has(ad.id)) return 2;
  return 1;
}

export default function AdsProcessing() {
  const [accountId, setAccountId] = useState('');
  const { data: adAccounts } = useAdAccounts();
  const selectedAccount = adAccounts?.find(a => a.accountId === accountId);
  const missingAccountFields = getMissingAccountFields(selectedAccount);
  const isAccountIncomplete = !!selectedAccount && missingAccountFields.length > 0;
  const [headlineFilter, setHeadlineFilter] = useState('');
  const [bodyFilter, setBodyFilter] = useState('');
  const [adTypeFilter, setAdTypeFilter] = useState('all');
  const [generalFilter, setGeneralFilter] = useState('');
  const [campaignFilter, setCampaignFilter] = useState<string[]>([]);
  const [adsetFilter, setAdsetFilter] = useState<string[]>([]);
  const [activeOnly, setActiveOnly] = useState(false);
  const [ads, setAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  // Rotating quirky quote shown while the AI is processing
  const [aiQuoteIndex, setAiQuoteIndex] = useState(0);
  useEffect(() => {
    if (!aiProcessing) return;
    // Pick a random starting quote each time so users don't see the same one first
    setAiQuoteIndex(Math.floor(Math.random() * aiQuotes.length));
    const id = setInterval(() => {
      setAiQuoteIndex(i => (i + 1) % aiQuotes.length);
    }, 3000);
    return () => clearInterval(id);
  }, [aiProcessing]);
  // Track which suggestion text is being edited: key = "adId-field-index"
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  // Collapse state for ad cards
  const [collapsedAds, setCollapsedAds] = useState<Set<string>>(new Set());

  // Scroll-to-top floating button: visible after the user scrolls past 600px
  // (roughly the height of the filter card + AI panel) so it doesn't show on
  // pages where there's nothing to scroll back to.
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // initial check in case the page is already scrolled
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const startEditSuggestion = (adId: string, field: string, index: number, currentText: string) => {
    setEditingKey(`${adId}-${field}-${index}`);
    setEditValue(currentText);
  };

  const saveEditSuggestion = (adId: string, field: 'headlines' | 'bodies' | 'descriptions', index: number) => {
    setAds(prev => prev.map(ad => {
      if (ad.id !== adId || !ad.aiSuggestion) return ad;
      const s = JSON.parse(ad.aiSuggestion);
      s[field][index] = editValue;
      return { ...ad, aiSuggestion: JSON.stringify(s) };
    }));
    setEditingKey(null);
  };


  // Revert a single suggestion field back to original
  const revertSuggestion = (adId: string, field: 'headlines' | 'bodies' | 'descriptions', index: number) => {
    setAds(prev => prev.map(ad => {
      if (ad.id !== adId || !ad.aiSuggestion) return ad;
      const s = JSON.parse(ad.aiSuggestion);
      // Get the original value and set the suggestion to match it (effectively removing the change)
      const original = ad[field][index];
      if (s[field]) {
        s[field][index] = original;
      }
      // Check if ALL suggestions now match originals — if so, clear aiSuggestion entirely
      const allMatch =
        (s.headlines || []).every((h: string, i: number) => h === ad.headlines[i]) &&
        (s.bodies || []).every((b: string, i: number) => b === ad.bodies[i]) &&
        (s.descriptions || []).every((d: string, i: number) => d === ad.descriptions[i]);
      return { ...ad, aiSuggestion: allMatch ? null : JSON.stringify(s) };
    }));
  };

  const matchesAny = (arr: string[], q: string) =>
    arr.some(t => t.toLowerCase().includes(q.toLowerCase()));

  // Campaign + ad set options derived from loaded ads.
  // Ad set list cascades: when campaigns are selected, restrict to their ad sets;
  // otherwise show ad sets from every loaded ad.
  const campaignOptions = (() => {
    const map = new Map<string, string>();
    ads.forEach(a => { if (a.campaignId) map.set(a.campaignId, a.campaignName || a.campaignId); });
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  })();

  const adsetOptions = (() => {
    const map = new Map<string, string>();
    const scope = campaignFilter.length > 0
      ? ads.filter(a => a.campaignId && campaignFilter.includes(a.campaignId))
      : ads;
    scope.forEach(a => { if (a.adsetId) map.set(a.adsetId, a.adsetName || a.adsetId); });
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  })();

  // Drop ad set selections that no longer belong to the active campaign scope.
  useEffect(() => {
    if (adsetFilter.length === 0) return;
    const valid = new Set(adsetOptions.map(o => o.value));
    const pruned = adsetFilter.filter(id => valid.has(id));
    if (pruned.length !== adsetFilter.length) setAdsetFilter(pruned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignFilter, ads]);

  // Filter logic — searches across ALL text variants
  const filteredAds = ads.filter(ad => {
    if (headlineFilter && !matchesAny(ad.headlines, headlineFilter)) return false;
    if (bodyFilter && !matchesAny(ad.bodies, bodyFilter)) return false;
    if (adTypeFilter !== 'all' && ad.adType !== adTypeFilter) return false;
    if (campaignFilter.length > 0 && (!ad.campaignId || !campaignFilter.includes(ad.campaignId))) return false;
    if (adsetFilter.length > 0 && (!ad.adsetId || !adsetFilter.includes(ad.adsetId))) return false;
    if (generalFilter) {
      const q = generalFilter;
      if (
        !ad.name.toLowerCase().includes(q.toLowerCase()) &&
        !matchesAny(ad.headlines, q) &&
        !matchesAny(ad.bodies, q) &&
        !matchesAny(ad.descriptions, q)
      ) return false;
    }
    if (activeOnly && ad.status !== 'ACTIVE') return false;
    return true;
  });

  const selectedAds = filteredAds.filter(a => a.selected);
  const allFilteredSelected = filteredAds.length > 0 && filteredAds.every(a => a.selected);

  // Collapse helpers
  const toggleAdCollapse = (adId: string) => {
    setCollapsedAds(prev => {
      const next = new Set(prev);
      next.has(adId) ? next.delete(adId) : next.add(adId);
      return next;
    });
  };
  const collapseAll = () => setCollapsedAds(new Set(filteredAds.map(a => a.id)));
  const collapseUnselected = () => {
    const selectedIds = new Set(selectedAds.map(a => a.id));
    setCollapsedAds(new Set(filteredAds.filter(a => !selectedIds.has(a.id)).map(a => a.id)));
  };
  const expandAll = () => setCollapsedAds(new Set());

  const toggleSelect = (id: string) => {
    setAds(prev => prev.map(a => a.id === id ? { ...a, selected: !a.selected } : a));
  };

  const toggleSelectAll = () => {
    const ids = new Set(filteredAds.map(a => a.id));
    const newVal = !allFilteredSelected;
    setAds(prev => prev.map(a => ids.has(a.id) ? { ...a, selected: newVal } : a));
  };

  const handleRefresh = async () => {
    if (!accountId) return;
    setIsLoading(true);
    try {
      const data = await invokeEdgeFunction<MetaFetchAdsResponse>('meta-fetch-ads', { account_id: accountId });
      const mapped: Ad[] = (data.ads || []).map(a => ({
        id: a.id,
        name: a.name,
        headlines: a.headlines || [],
        bodies: a.bodies || [],
        descriptions: a.descriptions || [],
        status: (a.status || 'ACTIVE') as Ad['status'],
        adType: (a.ad_type || 'IMAGE') as Ad['adType'],
        campaignId: a.campaign_id ?? null,
        campaignName: a.campaign_name ?? null,
        adsetId: a.adset_id ?? null,
        adsetName: a.adset_name ?? null,
        scheduleStart: a.ad_schedule_start_time ?? null,
        scheduleEnd: a.ad_schedule_end_time ?? null,
        selected: false,
        modified: false,
      }));
      // Deduplicate by id. Meta's pagination occasionally returns the same ad
      // on the boundary between two pages, which would cause Push to Meta to
      // process the same ad multiple times. Keeping the first occurrence is
      // safe — duplicates are byte-identical anyway.
      const seenIds = new Set<string>();
      const deduped = mapped.filter(ad => {
        if (seenIds.has(ad.id)) return false;
        seenIds.add(ad.id);
        return true;
      });
      const dupeCount = mapped.length - deduped.length;
      if (dupeCount > 0) {
        console.warn(`[meta-fetch-ads] Removed ${dupeCount} duplicate ad(s) from fetch result`);
      }
      setAds(deduped);
      toast.success(`Loaded ${deduped.length} ads`);
    } catch (err) {
      toast.error(`Failed to load ads: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAiProcess = async () => {
    if (!aiPrompt.trim() || selectedAds.length === 0) return;
    setAiProcessing(true);
    try {
      const payload = selectedAds.map(a => ({
        id: a.id,
        headlines: a.headlines,
        bodies: a.bodies,
        descriptions: a.descriptions,
      }));

      const result = await bulkEditAds(aiPrompt, payload);
      const analyzedAt = Date.now();

      // Update ads: attach aiSuggestion only when there are real changes,
      // stamp aiAnalyzedAt on every ad we sent so the sort can find them.
      const updated = ads.map(ad => {
        if (!result.suggestions[ad.id]) return ad;
        const suggestion = result.suggestions[ad.id];
        const isModified = result.modifiedAdIds.has(ad.id);
        return {
          ...ad,
          aiAnalyzedAt: analyzedAt,
          // Only attach aiSuggestion if there's actually something to show
          aiSuggestion: isModified ? JSON.stringify(suggestion) : undefined,
        };
      });

      // Sort: modified (this run) first → unchanged (this run) at the bottom
      // → never-analyzed in the middle, original order preserved within each group.
      const sorted = [...updated].sort((a, b) => {
        const aGroup = groupForSort(a, analyzedAt, result);
        const bGroup = groupForSort(b, analyzedAt, result);
        if (aGroup !== bGroup) return aGroup - bGroup;
        // Within a group, preserve original order
        return updated.indexOf(a) - updated.indexOf(b);
      });

      setAds(sorted);

      // User feedback
      if (result.modifiedAdIds.size === 0) {
        toast.warning(
          'AI determined the instruction does not apply to any selected ads. ' +
          'Try a more specific or different instruction.'
        );
      } else {
        let msg = `Generated suggestions for ${result.modifiedAdIds.size} of ${selectedAds.length} ads`;
        if (result.unchangedAdIds.size > 0) {
          msg += ` (${result.unchangedAdIds.size} unchanged)`;
        }
        toast.success(msg);
      }

      if (result.droppedAdIds.length > 0) {
        console.warn(`[AI Bulk Edit] ${result.droppedAdIds.length} ads were auto-filled with originals due to model drop. See console for IDs.`);
      }
    } catch (err) {
      toast.error(`AI processing failed: ${(err as Error).message}`);
    } finally {
      setAiProcessing(false);
    }
  };

  const acceptSuggestion = (id: string) => {
    setAds(prev => prev.map(ad => {
      if (ad.id !== id || !ad.aiSuggestion) return ad;
      const s = JSON.parse(ad.aiSuggestion);
      return { ...ad, headlines: s.headlines, bodies: s.bodies, descriptions: s.descriptions, aiSuggestion: undefined, modified: true };
    }));
  };

  const rejectSuggestion = (id: string) => {
    setAds(prev => prev.map(ad => ad.id === id ? { ...ad, aiSuggestion: undefined } : ad));
  };

  const acceptAll = () => {
    setAds(prev => prev.map(ad => {
      if (!ad.aiSuggestion) return ad;
      const s = JSON.parse(ad.aiSuggestion);
      return { ...ad, headlines: s.headlines, bodies: s.bodies, descriptions: s.descriptions, aiSuggestion: undefined, modified: true };
    }));
  };

  const discardAll = () => {
    setAds(prev => prev.map(ad => ad.aiSuggestion ? { ...ad, aiSuggestion: undefined } : ad));
  };

  const [isPushing, setIsPushing] = useState(false);

  const handlePushToMeta = async () => {
    // Defensive dedupe: even though handleRefresh already dedupes on fetch,
    // we dedupe again here so any future code path that adds duplicates
    // (e.g. a partial-refresh or merge) can never cause double-processing.
    const modifiedAds: Ad[] = [];
    const seenIds = new Set<string>();
    for (const ad of ads) {
      if (!ad.modified) continue;
      if (seenIds.has(ad.id)) continue;
      seenIds.add(ad.id);
      modifiedAds.push(ad);
    }

    if (modifiedAds.length === 0) { toast.error('No modified ads to push'); return; }
    if (!accountId) { toast.error('Select an ad account first'); return; }

    setIsPushing(true);
    let successCount = 0;
    let failCount = 0;
    let firstError: string | null = null;

    for (const ad of modifiedAds) {
      try {
        // Step 1: GET the existing creative. We need name + asset_feed_spec
        // + object_story_spec + degrees_of_freedom_spec + url_tags so the
        // builder can clone everything verbatim and only swap text fields.
        // degrees_of_freedom_spec is critical — without it, Advantage+ ads
        // silently lose their AI features on update.
        const adData = await metaGet(
          accountId,
          `${ad.id}?fields=name,creative{id,name,asset_feed_spec,object_story_spec,degrees_of_freedom_spec,url_tags}`
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const creative = (adData as any)?.creative;
        if (!creative) throw new Error('Could not fetch creative for ad');

        // Step 2: build the new-creative payload. Meta does not allow most
        // creative fields to be edited in place, so we mint a brand-new
        // creative and rebind the ad to it. See src/lib/metaCreativeUpdate.ts
        // for the dispatch table covering all known ad shapes.
        const { payload, family, format } = buildCreativeUpdate(ad, creative);
        console.log(`[Push to Meta] ${ad.name} (${ad.id}) — ${family}/${format}`, payload);

        // Step 3: POST the new creative
        const createRes = await metaPost(accountId, `act_${accountId}/adcreatives`, payload);
        const newCreativeId = (createRes as { id?: string }).id;
        if (!newCreativeId) throw new Error('Meta did not return a creative id');

        // Step 4: rebind the ad to the new creative
        await metaPost(accountId, `${ad.id}`, {
          creative: { creative_id: newCreativeId },
        });

        console.log(`[Push to Meta] ✓ ${ad.name} → creative ${newCreativeId}`);
        successCount++;
        setAds(prev => prev.map(a => a.id === ad.id ? { ...a, modified: false } : a));
      } catch (err) {
        failCount++;
        const msg = (err as Error).message || String(err);
        // Capture the first error verbatim so the user sees what Meta actually
        // said, instead of just a count. Subsequent errors still get logged
        // individually to the console for debugging.
        if (firstError === null) firstError = msg;
        console.error(`[Push to Meta] Failed for ${ad.name} (${ad.id}):`, msg, err);
      }
    }

    setIsPushing(false);
    if (successCount > 0) toast.success(`Updated ${successCount} ad(s) on Meta`);
    if (failCount > 0) {
      // Truncate long Meta errors so the toast stays readable; the console has the full thing.
      const shortError = firstError && firstError.length > 140
        ? firstError.slice(0, 140) + '…'
        : firstError;
      toast.error(
        `Failed to update ${failCount} ad(s). First error: ${shortError ?? 'unknown'}`,
        { duration: 10000 }
      );
    }
  };

  const adsWithSuggestions = ads.filter(a => a.aiSuggestion);

  /** Renders a list of text items with optional AI before/after diff */
  const renderTextList = (
    adId: string,
    label: string,
    field: 'headlines' | 'bodies' | 'descriptions',
    originals: string[],
    suggestions: string[] | null,
  ) => {
    if (originals.length === 0 && (!suggestions || suggestions.length === 0)) return null;
    const singularLabel = label.replace(/s$/, ''); // "Headlines" → "Headline", "Bodies" → "Bodie" → handled below
    const itemLabel = label === 'Bodies' ? 'Body' : label === 'Headlines' ? 'Headline' : label === 'Descriptions' ? 'Description' : singularLabel;
    return (
      <div className="space-y-3">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}{originals.length > 1 ? ` (${originals.length})` : ''}</span>
        {originals.map((text, i) => {
          const suggested = suggestions?.[i];
          const changed = suggested && suggested !== text;
          const key = `${adId}-${field}-${i}`;
          const isEditing = editingKey === key;
          return (
            <div key={i} className="space-y-1">
              {originals.length > 1 && (
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{itemLabel} {i + 1}</span>
              )}
              {changed ? (
                isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      className="h-7 text-xs py-0 px-2"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEditSuggestion(adId, field, i);
                        if (e.key === 'Escape') setEditingKey(null);
                      }}
                    />
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={() => saveEditSuggestion(adId, field, i)}>
                      <Check className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setEditingKey(null)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="bg-accent/30 rounded-xl p-3 border-l-4 border-green-500 group/edit">
                    <p className="text-sm text-muted-foreground line-through">{text}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p
                        className="text-sm font-bold text-green-700 cursor-pointer flex-1"
                        onClick={() => startEditSuggestion(adId, field, i, suggested!)}
                      >
                        {suggested}
                      </p>
                      <div className="flex items-center gap-1 opacity-0 group-hover/edit:opacity-100 transition-opacity">
                        <button onClick={() => startEditSuggestion(adId, field, i, suggested!)} className="p-1 hover:bg-background rounded" title="Edit suggestion">
                          <Pencil className="w-3 h-3 text-muted-foreground" />
                        </button>
                        <button onClick={() => revertSuggestion(adId, field, i)} className="p-1 hover:bg-background rounded" title="Revert to original">
                          <Undo2 className="w-3 h-3 text-amber-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <p className="text-xs leading-snug">{text}</p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  /** Renders text list for already-accepted (modified) ads */
  const renderModifiedTextList = (
    label: string,
    originals: string[],
  ) => {
    if (originals.length === 0) return null;
    const itemLabel = label === 'Bodies' ? 'Body' : label === 'Headlines' ? 'Headline' : label === 'Descriptions' ? 'Description' : label;
    return (
      <div className="space-y-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}{originals.length > 1 ? ` (${originals.length})` : ''}</span>
        {originals.map((text, i) => (
          <div key={i} className="space-y-0.5">
            {originals.length > 1 && (
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{itemLabel} {i + 1}</span>
            )}
            <p className="text-xs leading-snug">{text}</p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <AppLayout>
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/30 px-8 py-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight">Ads Processing</h1>
            {accountId && (
              <span className="px-2.5 py-1 rounded-lg bg-muted text-[11px] font-bold text-muted-foreground tracking-wider">{accountId}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">AI-powered bulk editing for your Meta ad copy</p>
        </div>
      </div>

      <div className={`p-8 max-w-7xl mx-auto space-y-6 ${ads.some(a => a.modified) ? 'pb-24' : ''}`}>
        {/* Filter Card */}
        <Card className="animate-fade-in">
          <CardContent className="pt-6 pb-6">
            {/* Account selector + Load Ads row */}
            <div className="flex items-end gap-4 mb-6">
              <div className="flex-1">
                <AccountSelector value={accountId} onChange={setAccountId} className="flex-1" />
              </div>
              <Button onClick={handleRefresh} disabled={!accountId || isLoading} className="bg-foreground text-background hover:bg-foreground/90 font-bold px-6 rounded-xl h-10">
                <Download className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Load Ads
              </Button>
            </div>

            {isAccountIncomplete && (
              <div className="mb-6 rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 animate-fade-in">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Account setup incomplete</p>
                    <p className="text-xs text-amber-900/80 dark:text-amber-200/80 mt-1 leading-relaxed">
                      <span className="font-semibold">{selectedAccount?.name}</span> is missing <span className="font-mono">{missingAccountFields.join(', ')}</span>. You can still load and edit existing ads on this page, but new campaigns cannot be launched from the Campaign Builder until these fields are configured in the main app.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Row 1 — scope filters: which campaigns/ad sets/types */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">
                <MultiSelect
                  options={campaignOptions}
                  value={campaignFilter}
                  onChange={setCampaignFilter}
                  placeholder={ads.length === 0 ? 'Campaigns (load ads first)' : 'All campaigns'}
                  searchPlaceholder="Search campaigns..."
                  emptyText="No campaigns"
                  disabled={ads.length === 0}
                />
              </div>
              <div className="col-span-4">
                <MultiSelect
                  options={adsetOptions}
                  value={adsetFilter}
                  onChange={setAdsetFilter}
                  placeholder={ads.length === 0 ? 'Ad sets (load ads first)' : 'All ad sets'}
                  searchPlaceholder="Search ad sets..."
                  emptyText="No ad sets"
                  disabled={ads.length === 0}
                />
              </div>
              <div className="col-span-2">
                <Select value={adTypeFilter} onValueChange={setAdTypeFilter}>
                  <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Ad type</SelectItem>
                    <SelectItem value="IMAGE">Image</SelectItem>
                    <SelectItem value="VIDEO">Video</SelectItem>
                    <SelectItem value="CAROUSEL">Carousel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex items-center justify-end">
                <div className="flex items-center gap-2">
                  <Checkbox checked={activeOnly} onCheckedChange={(v) => setActiveOnly(v === true)} id="active-only" />
                  <Label htmlFor="active-only" className="text-sm font-medium text-muted-foreground cursor-pointer">Active only</Label>
                </div>
              </div>
            </div>

            {/* Row 2 — text search */}
            <div className="grid grid-cols-12 gap-4 mt-4">
              <div className="col-span-4">
                <Input value={headlineFilter} onChange={e => setHeadlineFilter(e.target.value)} placeholder="Headline contains..." className="bg-muted/50" />
              </div>
              <div className="col-span-4">
                <Input value={bodyFilter} onChange={e => setBodyFilter(e.target.value)} placeholder="Body contains..." className="bg-muted/50" />
              </div>
              <div className="col-span-4">
                <Input value={generalFilter} onChange={e => setGeneralFilter(e.target.value)} placeholder="Search ID or text across all fields..." className="bg-muted/50" />
              </div>
            </div>

            {/* Counters */}
            <div className="mt-6 pt-6 border-t border-border/30 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total</span>
                <span className="bg-muted text-foreground px-2 py-0.5 rounded font-bold text-xs">{ads.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Filtered</span>
                <span className="bg-accent text-primary px-2 py-0.5 rounded font-bold text-xs">{filteredAds.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Selected</span>
                <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded font-bold text-xs">{selectedAds.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Guidance nudge — shown until ads are loaded */}
        {ads.length === 0 && !isLoading && (
          <div className="p-3 bg-accent rounded-lg text-sm text-accent-foreground animate-fade-in">
            {!accountId
              ? <>Select an <strong>Ad Account</strong> above, then click <strong>"Load Ads"</strong> to get started.</>
              : <>Click <strong>"Load Ads"</strong> to fetch your campaigns.</>
            }
          </div>
        )}

        {/* AI Bulk Edit Panel */}
        <Card className={cn(
          "border-2 border-primary shadow-xl shadow-primary/5 overflow-hidden transition-all duration-300",
          showAiPanel ? 'opacity-100' : 'opacity-70'
        )}>
          <div
            className="bg-accent px-6 py-4 flex items-center justify-between cursor-pointer"
            onClick={() => selectedAds.length > 0 && setShowAiPanel(!showAiPanel)}
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-foreground tracking-tight">
                AI Bulk Edit {selectedAds.length > 0 && <span className="ml-1 text-muted-foreground font-medium">({selectedAds.length} ads selected)</span>}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {selectedAds.length === 0 && <span className="text-xs text-muted-foreground">Select ads to enable</span>}
              {showAiPanel ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-primary" />}
            </div>
          </div>
          {showAiPanel && selectedAds.length > 0 && (
            <div className="p-6 space-y-4 animate-fade-in">
              <Textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder='Describe what you want to change. E.g.: "Replace spring break with summer break in all texts" or "Make the text shorter and more compelling". All text variants (headlines, bodies, descriptions) will be processed.'
                rows={3}
              />
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {aiProcessing && (
                    <p
                      key={aiQuoteIndex}
                      className="text-xs italic text-muted-foreground animate-fade-in flex items-center gap-2"
                    >
                      <Sparkles className="w-3 h-3 text-primary shrink-0 animate-pulse" />
                      <span className="truncate">{aiQuotes[aiQuoteIndex]}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {adsWithSuggestions.length > 0 && (
                    <>
                      <Button variant="outline" onClick={discardAll} className="border-destructive/40 text-destructive font-bold rounded-xl hover:bg-destructive/10">
                        <X className="w-4 h-4 mr-1" />
                        Discard All
                      </Button>
                      <Button variant="outline" onClick={acceptAll} className="border-primary text-primary font-bold rounded-xl hover:bg-accent">
                        <Check className="w-4 h-4 mr-1" />
                        Accept All ({adsWithSuggestions.length})
                      </Button>
                    </>
                  )}
                  <Button onClick={handleAiProcess} disabled={!aiPrompt.trim() || aiProcessing} className="bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
                    {aiProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Suggestions
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Ads List */}
        <div className="space-y-3">
          {/* Select all header + collapse controls */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} className="h-5 w-5" />
              <span className="text-xs font-medium text-muted-foreground">Select all</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={collapseUnselected} className="text-[11px] text-muted-foreground h-7 px-2">
                <ChevronsDownUp className="w-3.5 h-3.5 mr-1" /> Collapse unselected
              </Button>
              <Button variant="ghost" size="sm" onClick={collapseAll} className="text-[11px] text-muted-foreground h-7 px-2">
                <ChevronsDownUp className="w-3.5 h-3.5 mr-1" /> Collapse all
              </Button>
              <Button variant="ghost" size="sm" onClick={expandAll} className="text-[11px] text-muted-foreground h-7 px-2">
                <ChevronsUpDown className="w-3.5 h-3.5 mr-1" /> Expand all
              </Button>
            </div>
          </div>

          {filteredAds.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {isLoading ? 'Loading ads...' : 'No ads found. Select your Ad Account and click Load Ads.'}
              </CardContent>
            </Card>
          ) : (
            filteredAds.map(ad => {
              const suggestion = ad.aiSuggestion ? JSON.parse(ad.aiSuggestion) : null;
              return (
                <Card key={ad.id} className={cn(
                  "transition-all duration-200 animate-fade-in",
                  ad.selected && 'border-primary/30 bg-accent/10',
                  suggestion && 'ring-1 ring-primary/20'
                )}>
                  <CardContent className="py-5 px-6">
                    {/* Header row: checkbox + name + badges + actions + collapse */}
                    <div className="flex items-start gap-4">
                      <div className="pt-1">
                        <Checkbox checked={ad.selected} onCheckedChange={() => toggleSelect(ad.id)} className="h-5 w-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Ad name + badges row */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <h4 className="text-lg font-bold text-foreground truncate">{ad.name}</h4>
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
                            ad.adType === 'IMAGE' && 'bg-blue-50 text-blue-600',
                            ad.adType === 'VIDEO' && 'bg-slate-100 text-slate-600',
                            ad.adType === 'CAROUSEL' && 'bg-slate-100 text-slate-600',
                          )}>{ad.adType}</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
                            ad.status === 'ACTIVE' && 'bg-emerald-50 text-emerald-600',
                            ad.status === 'PAUSED' && 'bg-amber-50 text-amber-600',
                            ad.status === 'ARCHIVED' && 'bg-muted text-muted-foreground',
                          )}>{ad.status}</span>
                          {ad.modified && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 flex items-center gap-1">
                              <Pencil className="w-3 h-3" /> Modified
                            </span>
                          )}
                          {(ad.scheduleStart || ad.scheduleEnd) && (
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600"
                              title={`Scheduled delivery: ${ad.scheduleStart ? new Date(ad.scheduleStart).toLocaleString() : '—'} → ${ad.scheduleEnd ? new Date(ad.scheduleEnd).toLocaleString() : '—'}`}
                            >
                              Scheduled
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Accept/Reject buttons when suggestion is pending */}
                      {suggestion && (
                        <div className="flex items-center gap-1 shrink-0 pt-1">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-600 hover:bg-green-50" onClick={() => acceptSuggestion(ad.id)}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => rejectSuggestion(ad.id)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}

                      {/* Collapse toggle */}
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => toggleAdCollapse(ad.id)}>
                        {collapsedAds.has(ad.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </Button>
                    </div>

                    {/* Collapsible content */}
                    <div className={cn(
                      "overflow-hidden transition-all duration-300",
                      collapsedAds.has(ad.id) ? 'max-h-0 opacity-0 mt-0' : 'max-h-[2000px] opacity-100 mt-4'
                    )}>
                      <div className="space-y-3">
                        {renderTextList(ad.id, 'Headlines', 'headlines', ad.headlines, suggestion?.headlines)}
                        {renderTextList(ad.id, 'Bodies', 'bodies', ad.bodies, suggestion?.bodies)}
                        {renderTextList(ad.id, 'Descriptions', 'descriptions', ad.descriptions, suggestion?.descriptions)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Fixed Bottom "Push to Meta" Bar */}
      {ads.some(a => a.modified) && (
        <div className="fixed bottom-0 left-64 right-0 z-30 bg-foreground text-background px-8 py-4 flex items-center justify-between shadow-2xl animate-slide-up">
          <div className="flex items-center gap-4">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className="text-sm font-bold">{ads.filter(a => a.modified).length} ads modified</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="text-background/70 hover:text-background font-bold">
              Discard changes
            </Button>
            <Button onClick={handlePushToMeta} disabled={isPushing} className="bg-primary text-primary-foreground font-bold rounded-xl px-6 hover:scale-[1.02] transition-all">
              {isPushing ? 'Pushing...' : 'Push to Meta'}
            </Button>
          </div>
        </div>
      )}

      {/* Floating scroll-to-top button — appears after scrolling 600px down.
          Sits above the Push to Meta bar when modified ads exist. */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          aria-label="Scroll to top"
          title="Back to top"
          className={cn(
            'fixed right-6 z-40 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 animate-fade-in',
            ads.some(a => a.modified) ? 'bottom-24' : 'bottom-6'
          )}
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </AppLayout>
  );
}
