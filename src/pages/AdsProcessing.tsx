import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Filter, Search, Sparkles, Check, X, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AccountSelector } from '@/components/shared/AccountSelector';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { metaPost } from '@/lib/metaApi';
import { toast } from 'sonner';

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
  selected: boolean;
  modified: boolean;         // true after accepting AI suggestions (pending push to Meta)
  aiSuggestion?: string;     // JSON of { headlines: string[], bodies: string[], descriptions: string[] }
}

interface MetaFetchAdsResponse {
  ads: Array<{
    id: string;
    name: string;
    status: string;
    ad_type: string;
    headlines: string[];
    bodies: string[];
    descriptions: string[];
  }>;
}

interface AiBulkEditResponse {
  suggestions: Record<string, {
    headlines: string[];
    bodies: string[];
    descriptions: string[];
  }>;
}

export default function AdsProcessing() {
  const [accountId, setAccountId] = useState('');
  const [headlineFilter, setHeadlineFilter] = useState('');
  const [bodyFilter, setBodyFilter] = useState('');
  const [adTypeFilter, setAdTypeFilter] = useState('all');
  const [generalFilter, setGeneralFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [ads, setAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  // Track which suggestion text is being edited: key = "adId-field-index"
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

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


  const matchesAny = (arr: string[], q: string) =>
    arr.some(t => t.toLowerCase().includes(q.toLowerCase()));

  // Filter logic — searches across ALL text variants
  const filteredAds = ads.filter(ad => {
    if (headlineFilter && !matchesAny(ad.headlines, headlineFilter)) return false;
    if (bodyFilter && !matchesAny(ad.bodies, bodyFilter)) return false;
    if (adTypeFilter !== 'all' && ad.adType !== adTypeFilter) return false;
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
        selected: false,
        modified: false,
      }));
      setAds(mapped);
      toast.success(`Loaded ${mapped.length} ads`);
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
      const data = await invokeEdgeFunction<AiBulkEditResponse>('ai-bulk-edit', {
        prompt: aiPrompt,
        ads: payload,
      });
      setAds(prev => prev.map(ad => {
        const suggestion = data.suggestions?.[ad.id];
        if (!suggestion) return ad;
        return { ...ad, aiSuggestion: JSON.stringify(suggestion) };
      }));
      toast.success(`Generated suggestions for ${Object.keys(data.suggestions || {}).length} ads`);
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

  const [isPushing, setIsPushing] = useState(false);

  const handlePushToMeta = async () => {
    const modifiedAds = ads.filter(a => a.modified);
    if (modifiedAds.length === 0) { toast.error('No modified ads to push'); return; }
    if (!accountId) { toast.error('Select an ad account first'); return; }

    setIsPushing(true);
    let successCount = 0;
    let failCount = 0;

    for (const ad of modifiedAds) {
      try {
        // Fetch current ad creative to get existing spec
        const adData = await invokeEdgeFunction<Record<string, unknown>>('meta-proxy', {
          account_id: accountId,
          method: 'GET',
          path: `${ad.id}?fields=creative{id,asset_feed_spec,object_story_spec}`,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const creative = (adData as any)?.creative;
        if (!creative?.id) throw new Error('Could not fetch creative for ad');

        if (creative.asset_feed_spec) {
          // Asset feed spec ad — update titles, bodies, descriptions on the creative
          const updates: Record<string, unknown> = {};
          if (ad.headlines.length > 0) updates.titles = ad.headlines.map(t => ({ text: t }));
          if (ad.bodies.length > 0) updates.bodies = ad.bodies.map(t => ({ text: t }));
          if (ad.descriptions.length > 0) updates.descriptions = ad.descriptions.map(t => ({ text: t }));

          await metaPost(accountId, `${creative.id}`, {
            asset_feed_spec: { ...creative.asset_feed_spec, ...updates },
          });
        } else if (creative.object_story_spec) {
          // Simple ad — update link_data or video_data message/name
          const oss = creative.object_story_spec;
          const updatedOss = { ...oss };

          if (oss.link_data) {
            updatedOss.link_data = {
              ...oss.link_data,
              ...(ad.bodies[0] !== undefined && { message: ad.bodies[0] }),
              ...(ad.headlines[0] !== undefined && { name: ad.headlines[0] }),
              ...(ad.descriptions[0] !== undefined && { description: ad.descriptions[0] }),
            };
          } else if (oss.video_data) {
            updatedOss.video_data = {
              ...oss.video_data,
              ...(ad.bodies[0] !== undefined && { message: ad.bodies[0] }),
              ...(ad.headlines[0] !== undefined && { title: ad.headlines[0] }),
              ...(ad.descriptions[0] !== undefined && { link_description: ad.descriptions[0] }),
            };
          }

          await metaPost(accountId, `${creative.id}`, {
            object_story_spec: updatedOss,
          });
        }

        successCount++;
        setAds(prev => prev.map(a => a.id === ad.id ? { ...a, modified: false } : a));
      } catch (err) {
        failCount++;
        console.error(`[Push to Meta] Failed for ${ad.name}:`, err);
      }
    }

    setIsPushing(false);
    if (successCount > 0) toast.success(`Updated ${successCount} ad(s) on Meta`);
    if (failCount > 0) toast.error(`Failed to update ${failCount} ad(s)`);
  };

  const adsWithSuggestions = ads.filter(a => a.aiSuggestion);

  // Count total text variants across all ads
  const totalTextVariants = (ad: Ad) => ad.headlines.length + ad.bodies.length + ad.descriptions.length;

  /** Renders a list of text items with optional AI before/after diff */
  const renderTextList = (
    adId: string,
    label: string,
    field: 'headlines' | 'bodies' | 'descriptions',
    originals: string[],
    suggestions: string[] | null,
  ) => {
    if (originals.length === 0 && (!suggestions || suggestions.length === 0)) return null;
    return (
      <div className="space-y-0.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}{originals.length > 1 ? ` (${originals.length})` : ''}</span>
        {originals.map((text, i) => {
          const suggested = suggestions?.[i];
          const changed = suggested && suggested !== text;
          const key = `${adId}-${field}-${i}`;
          const isEditing = editingKey === key;
          return (
            <div key={i} className="text-xs leading-snug">
              {changed ? (
                <div className="space-y-0.5">
                  <div className="line-through text-muted-foreground">{text}</div>
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        className="h-6 text-xs py-0 px-1.5"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEditSuggestion(adId, field, i);
                          if (e.key === 'Escape') setEditingKey(null);
                        }}
                      />
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-success" onClick={() => saveEditSuggestion(adId, field, i)}>
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground" onClick={() => setEditingKey(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group/edit">
                      <div className="text-success font-medium bg-success/10 rounded px-1.5 py-0.5 flex-1">{suggested}</div>
                      <button
                        onClick={() => startEditSuggestion(adId, field, i, suggested!)}
                        className="opacity-0 group-hover/edit:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="line-clamp-2">{text}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground font-display">Ads Processing</h1>
          {accountId && (
            <span className="text-sm text-muted-foreground">Account: {accountId}</span>
          )}
        </div>

        {/* Account ID + Refresh */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3 items-end">
              <AccountSelector value={accountId} onChange={setAccountId} className="flex-1" />
              <Button variant="outline" onClick={handleRefresh} disabled={!accountId || isLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Apply
              </Button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Filter className="w-3 h-3 text-primary" /> Filter by headline
                </Label>
                <Input
                  value={headlineFilter}
                  onChange={e => setHeadlineFilter(e.target.value)}
                  placeholder="Search in headlines only"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Filter className="w-3 h-3 text-primary" /> Filter by ad copy
                </Label>
                <Input
                  value={bodyFilter}
                  onChange={e => setBodyFilter(e.target.value)}
                  placeholder="Search in ad copy only"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Ad Type</Label>
                <Select value={adTypeFilter} onValueChange={setAdTypeFilter}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="IMAGE">Image</SelectItem>
                    <SelectItem value="VIDEO">Video</SelectItem>
                    <SelectItem value="CAROUSEL">Carousel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Search className="w-3 h-3 text-primary" /> General filter
                </Label>
                <Input
                  value={generalFilter}
                  onChange={e => setGeneralFilter(e.target.value)}
                  placeholder="Search in names, headlines..."
                  className="text-sm"
                />
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={activeOnly}
                    onCheckedChange={(v) => setActiveOnly(v === true)}
                    id="active-only"
                  />
                  <Label htmlFor="active-only" className="text-sm text-muted-foreground cursor-pointer">
                    Active ads only
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Counters */}
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-xs">Total: {filteredAds.length}</Badge>
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
            Filtered: {filteredAds.length}
          </Badge>
          <Badge className="text-xs bg-accent text-accent-foreground">
            Selected: {selectedAds.length}
          </Badge>

          {selectedAds.length > 0 && (
            <Button
              size="sm"
              onClick={() => setShowAiPanel(!showAiPanel)}
              className="ml-auto"
            >
              <Sparkles className="w-4 h-4 mr-1" />
              AI Bulk Edit
              {showAiPanel ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </Button>
          )}
        </div>

        {/* AI Bulk Edit Panel */}
        {showAiPanel && selectedAds.length > 0 && (
          <Card className="border-primary/20 bg-accent/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                AI Bulk Edit — {selectedAds.length} ads selected ({selectedAds.reduce((sum, a) => sum + totalTextVariants(a), 0)} text variants)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder='Describe what you want to change. E.g.: "Replace spring break with summer break in all texts" or "Make the text shorter and more compelling". All text variants (headlines, bodies, descriptions) will be processed.'
                rows={3}
              />
              <div className="flex gap-2">
                <Button onClick={handleAiProcess} disabled={!aiPrompt.trim() || aiProcessing}>
                  {aiProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1" />
                      Generate Suggestions
                    </>
                  )}
                </Button>
                {adsWithSuggestions.length > 0 && (
                  <Button variant="outline" onClick={acceptAll} className="text-success border-success/30 hover:bg-success/10">
                    <Check className="w-4 h-4 mr-1" />
                    Accept All ({adsWithSuggestions.length})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Push to Meta bar — visible when ads have been modified */}
        {ads.some(a => a.modified) && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <span className="text-sm text-foreground">
                <strong>{ads.filter(a => a.modified).length}</strong> ad(s) modified — ready to push to Meta
              </span>
              <Button onClick={handlePushToMeta} disabled={isPushing}>
                {isPushing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                    Pushing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Push to Meta
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Ads List — card-based to handle multi-text well */}
        <div className="space-y-2">
          {/* Select all header */}
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 rounded-lg">
            <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} />
            <span className="text-xs font-medium text-muted-foreground w-[160px] shrink-0">Ad Name</span>
            <span className="text-xs text-muted-foreground flex-[2]">Headlines / Bodies / Descriptions</span>
            <span className="text-xs text-muted-foreground w-16 shrink-0 text-center">Type</span>
            <span className="text-xs text-muted-foreground w-16 shrink-0 text-center">Status</span>
            <span className="w-16 shrink-0" />
          </div>

          {filteredAds.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {isLoading ? 'Loading ads...' : 'No ads found. Select your Ad Account and click Apply.'}
              </CardContent>
            </Card>
          ) : (
            filteredAds.map(ad => {
              const suggestion = ad.aiSuggestion ? JSON.parse(ad.aiSuggestion) : null;
              return (
                <Card key={ad.id} className={`transition-colors ${ad.selected ? 'border-primary/30 bg-accent/10' : ''}`}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <div className="pt-0.5">
                        <Checkbox checked={ad.selected} onCheckedChange={() => toggleSelect(ad.id)} />
                      </div>

                      {/* Ad name */}
                      <div className="w-[160px] shrink-0">
                        <div className="font-medium text-sm text-foreground">{ad.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {totalTextVariants(ad)} text variant{totalTextVariants(ad) > 1 ? 's' : ''}
                        </div>
                        {ad.modified && (
                          <Badge variant="secondary" className="text-[9px] mt-1 bg-amber-100 text-amber-700">Modified</Badge>
                        )}
                      </div>

                      {/* Text variants */}
                      <div className="flex-[2] space-y-2 min-w-0">
                        {renderTextList(ad.id, 'Headlines', 'headlines', ad.headlines, suggestion?.headlines)}
                        {renderTextList(ad.id, 'Bodies', 'bodies', ad.bodies, suggestion?.bodies)}
                        {renderTextList(ad.id, 'Descriptions', 'descriptions', ad.descriptions, suggestion?.descriptions)}
                      </div>

                      {/* Type */}
                      <div className="w-16 shrink-0 text-center pt-0.5">
                        <Badge variant="secondary" className="text-[10px]">{ad.adType}</Badge>
                      </div>

                      {/* Status */}
                      <div className="w-16 shrink-0 text-center pt-0.5">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${
                            ad.status === 'ACTIVE'
                              ? 'bg-success/15 text-success'
                              : ad.status === 'PAUSED'
                              ? 'bg-warning/15 text-warning'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {ad.status}
                        </Badge>
                      </div>

                      {/* Actions */}
                      <div className="w-16 shrink-0 flex justify-end gap-1 pt-0.5">
                        {suggestion && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-success hover:bg-success/10" onClick={() => acceptSuggestion(ad.id)}>
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => rejectSuggestion(ad.id)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
