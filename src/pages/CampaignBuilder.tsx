import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AccountSelector } from '@/components/shared/AccountSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ChevronUp, ChevronDown, Copy, Loader2, CheckCircle2, AlertCircle, Rocket, Pencil, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useTemplateStore, createEmptyCampaignTemplate, createEmptyAdsetTemplate, createEmptyAdTemplate, createEmptyAdvantageCreativeTemplate } from '@/store/templateStore';
import { CampaignTemplateForm } from '@/components/templates/CampaignTemplateForm';
import { AdsetTemplateForm } from '@/components/templates/AdsetTemplateForm';
import { AdTemplateForm, AdvantageCreativeForm } from '@/pages/Templates';
import type { CampaignTemplate, AdsetTemplate, AdTemplate, AdvantageCreativeTemplate } from '@/types/templates';
import { cn } from '@/lib/utils';
import { CreativeSection, createEmptyCreativeData, type CreativeData } from '@/components/builder/CreativeSection';
import { DocumentImport, type ParsedDocument } from '@/components/builder/DocumentImport';
import { AITemplateRecommender } from '@/components/builder/AITemplateRecommender';
import { launchCampaign, type LaunchResult } from '@/lib/campaignService';
import { useAuth } from '@/contexts/AuthContext';
import { useAdAccounts, getMissingAccountFields } from '@/hooks/useAdAccounts';
import { useLeadForms } from '@/hooks/useLeadForms';
import { useProductSets } from '@/hooks/useProductSets';
import { useCatalogs } from '@/hooks/useCatalogs';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useAdSets } from '@/hooks/useAdSets';
import { Combobox } from '@/components/shared/Combobox';
import { DateTimePicker } from '@/components/shared/DateTimePicker';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

// ── Launch overlay quotes ──
const launchQuotes = [
  "Brewing your campaign magic...",
  "Teaching Meta about your audience...",
  "Your ads are getting dressed for the big show...",
  "Connecting pixels to people...",
  "Good things take a few seconds...",
  "Turning your creativity into conversions...",
  "Warming up the Meta auction engine...",
  "Preparing your message for the world...",
  "Aligning the stars for your campaign...",
  "Crafting the perfect ad experience...",
  "Optimizing for maximum impact...",
  "Your audience is about to meet their new favorite brand...",
  "Building bridges between your brand and customers...",
  "Setting up your digital storefront...",
  "Fine-tuning the targeting parameters...",
  "Calibrating the bidding strategy...",
  "Loading creative assets into the pipeline...",
  "Syncing with Meta's ad delivery system...",
  "Almost there — great campaigns take a moment...",
  "Packaging your ad copy with care...",
  "Spinning up the creative engine...",
  "Your campaign is about to make its debut...",
  "Handshaking with Meta's servers...",
  "Validating creative specs with Meta...",
  "Uploading your vision to the cloud...",
  "Preparing placement optimization rules...",
  "Mapping your audience across platforms...",
  "Assembling the perfect ad cocktail...",
  "Turning headlines into scroll-stoppers...",
  "Your ROI journey starts now...",
  "Making sure every pixel is in place...",
  "Configuring cross-platform delivery...",
  "Initializing the engagement engine...",
  "Setting sail on the Meta ocean...",
  "Fueling up for launch...",
  "Polishing your ad creative one last time...",
  "Checking the flight plan for your campaign...",
  "Activating audience intelligence...",
  "Preparing your brand's digital megaphone...",
  "Running final pre-flight checks...",
  "Your competitors won't know what hit them...",
  "Locking in your budget allocation...",
  "Encoding creative assets for delivery...",
  "Meta is rolling out the red carpet for your ads...",
  "Translating your strategy into results...",
  "Registering your campaign with the auction house...",
  "Dialing in the frequency caps...",
  "Your ad copy is stretching before the marathon...",
  "Queueing up impressions...",
  "Igniting the campaign boosters...",
  "Warming up the A/B testing engine...",
  "Securing your spot in the auction...",
  "Deploying ads to feed, story, and reels...",
  "Your brand story is about to unfold...",
  "Distributing creative across placements...",
  "Tightening the targeting bolts...",
  "Whispering to the algorithm about your ideal customer...",
  "Planting seeds for your conversion garden...",
  "Loading the creative cannon...",
  "Calculating optimal delivery windows...",
  "Tuning the relevance score antenna...",
  "Your campaign DNA is being sequenced...",
  "Establishing communication with Meta HQ...",
  "Wrapping your message in the perfect format...",
  "Charging up the impression battery...",
  "Mixing the perfect audience cocktail...",
  "Your ads are in the green room, ready for the spotlight...",
  "Programming the delivery schedule...",
  "Encrypting and transmitting campaign data...",
  "Briefing the Meta AI on your objectives...",
  "Hang tight — brilliance is loading...",
  "Strapping in for liftoff...",
  "Telling Meta's algorithm your brand's story...",
  "Crunching the numbers for optimal spend...",
  "Your creative is boarding the delivery vehicle...",
  "Painting the digital billboard...",
  "Wiring up the conversion tracking...",
  "Negotiating prime ad real estate...",
  "Your campaign is clearing the runway...",
  "Orchestrating the multi-platform symphony...",
  "Hold tight — your ads are almost live...",
  "Plugging into the social media matrix...",
  "Finalizing the audience segmentation...",
  "Your brand's signal is being amplified...",
  "Dispatching creative agents across the metaverse...",
  "Calibrating the engagement radar...",
  "Launching in 3... 2... 1...",
  "Preparing to capture hearts and clicks...",
  "Aligning budget with opportunity...",
  "Your campaign is being gift-wrapped for delivery...",
  "Initiating the impression delivery sequence...",
  "Turbocharging your reach...",
  "The algorithm is excited about this one...",
  "Deploying your secret marketing weapon...",
  "Channeling creative energy into conversions...",
  "Synchronizing ad sets with the Meta ecosystem...",
  "Your message is finding its perfect audience...",
  "Buckle up — campaign launch in progress...",
  "Making marketing magic happen...",
];

interface AdEntry {
  id: string;
  name: string;
  productSetId: string;
  // Catalog the productSetId belongs to. Captured when picking from the
  // combobox; null otherwise. Required for Advantage+ catalog ad creative.
  productCatalogId: string | null;
  // Optional per-ad URL override. When set, takes precedence over the ad
  // template's conversionDomain. Only surfaced for SINGLE_IMAGE/SINGLE_VIDEO —
  // carousels use per-card URLs instead.
  urlOverride: string;
  // Optional per-ad delivery schedule (Meta's ad_schedule_start_time /
  // ad_schedule_end_time). Empty string = not scheduled. Stored as an
  // ISO-8601 local datetime string (no timezone); the launch flow appends
  // the browser's timezone offset when sending to Meta.
  scheduleStart: string;
  scheduleEnd: string;
  headlines: string[];
  primaryTexts: string[];
  creative: CreativeData;
  adTemplateId: string;
  advantageCreativeId: string;
  leadFormId: string;
  collapsed: boolean;
}

interface AdSetEntry {
  id: string;
  name: string;
  type: 'new' | 'existing';
  existingAdsetId: string;
  adsetTemplateId: string;
  ads: AdEntry[];
  collapsed: boolean;
}

/**
 * Convert a datetime-local string ("2026-06-02T14:30") to the ISO-8601 format
 * Meta expects with the browser's timezone offset appended ("2026-06-02T14:30:00+0530").
 * Returns null for empty input so callers can omit the field from the payload.
 */
function toMetaScheduleTime(local: string): string | null {
  if (!local?.trim()) return null;
  const d = new Date(local);
  if (isNaN(d.getTime())) return null;
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${hh}${mm}`;
}

function createAd(index: number): AdEntry {
  return {
    id: crypto.randomUUID(),
    name: `Ad ${index}`,
    productSetId: '',
    productCatalogId: null,
    urlOverride: '',
    scheduleStart: '',
    scheduleEnd: '',
    headlines: [''],
    primaryTexts: [''],
    creative: createEmptyCreativeData(),
    adTemplateId: '',
    advantageCreativeId: '',
    leadFormId: '',
    collapsed: false,
  };
}

function createAdSet(index: number): AdSetEntry {
  return {
    id: crypto.randomUUID(),
    name: `Ad Set ${index}`,
    type: 'new',
    existingAdsetId: '',
    adsetTemplateId: '',
    ads: [createAd(1)],
    collapsed: false,
  };
}

/**
 * Per-ad Product Set picker. Defaults to a plain ID input (no Meta call).
 * Toggling "Pick from catalog" fetches the catalog's product sets via meta-proxy
 * and swaps the input for a searchable combobox that still allows manual IDs.
 */
function ProductSetField({
  accountId,
  catalogId,
  value,
  onChange,
}: {
  accountId: string;
  catalogId: string | null | undefined;
  value: string;
  // Bubbles BOTH the product set ID and the catalog ID it belongs to. Meta
  // requires the catalog context to build an Advantage+ catalog creative,
  // so we capture the resolved catalog at pick-time.
  onChange: (productSetId: string, productCatalogId: string | null) => void;
}) {
  const [pickFromCatalog, setPickFromCatalog] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const effectiveCatalogId = catalogId || selectedCatalogId || null;
  const shouldFetch = pickFromCatalog && !!accountId && !!effectiveCatalogId;
  const { data: productSets, isLoading, error } = useProductSets(accountId, effectiveCatalogId, shouldFetch);
  // Only fetch the catalog list when we actually need it (toggle on + template has no catalog).
  const { data: catalogs, isLoading: loadingCatalogs, error: catalogsError } =
    useCatalogs(accountId, pickFromCatalog && !catalogId);

  const options = (productSets || []).map(p => ({ value: p.id, label: p.name }));

  return (
    <div>
      <div className="flex items-center justify-between mt-0.5">
        <Label className="text-xs text-muted-foreground">Product Set ID (Optional)</Label>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Pick from catalog</span>
          <Switch
            checked={pickFromCatalog}
            onCheckedChange={setPickFromCatalog}
            disabled={!accountId}
          />
        </div>
      </div>
      {pickFromCatalog ? (
        <div className="space-y-2 mt-1">
          {!catalogId && (
            <div>
              <Label className="text-[10px] text-muted-foreground">Catalog</Label>
              <Combobox
                options={(catalogs || []).map(c => ({ value: c.id, label: c.name }))}
                value={selectedCatalogId}
                onChange={setSelectedCatalogId}
                placeholder="Select a catalog..."
                searchPlaceholder="Search catalogs..."
                emptyText={catalogsError ? `Error: ${(catalogsError as Error).message}` : 'No catalogs found'}
                loading={loadingCatalogs}
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Tip: set a Catalog ID on the campaign template to skip this step next time.
              </p>
            </div>
          )}
          <Combobox
            options={options}
            value={value}
            onChange={v => onChange(v, v ? effectiveCatalogId : null)}
            placeholder={effectiveCatalogId ? 'Select Product Set...' : 'Pick a catalog above first'}
            searchPlaceholder="Search..."
            emptyText={error ? `Error: ${(error as Error).message}` : 'No product sets found'}
            loading={isLoading}
            disabled={!effectiveCatalogId}
          />
        </div>
      ) : (
        <Input
          value={value}
          onChange={e => onChange(e.target.value, e.target.value ? (catalogId || null) : null)}
          placeholder="Product Set ID (Optional)"
          className="mt-1"
        />
      )}
    </div>
  );
}

export default function CampaignBuilder() {
  const [accountId, setAccountId] = useState('');
  const [campaignType, setCampaignType] = useState<'new' | 'existing'>('new');

  // Fetch campaigns + ad sets only when the builder is in "existing" mode and
  // an account is chosen. React Query caches for 5 min so switching ad sets
  // doesn't re-fetch.
  const { data: existingCampaigns, isLoading: loadingCampaigns } =
    useCampaigns(accountId, true);
  const { data: existingAdSets, isLoading: loadingAdSets } =
    useAdSets(accountId, true);

  const [campaignName, setCampaignName] = useState('');
  const [existingCampaignId, setExistingCampaignId] = useState('');
  const [campaignTemplateId, setCampaignTemplateId] = useState('');
  const [adSets, setAdSets] = useState<AdSetEntry[]>([createAdSet(1)]);
  const [isLaunching, setIsLaunching] = useState(false);
  const [docImportOpen, setDocImportOpen] = useState(false);
  const [launchQuote, setLaunchQuote] = useState('');
  const quoteIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rotate quotes during launch
  useEffect(() => {
    if (isLaunching) {
      setLaunchQuote(launchQuotes[Math.floor(Math.random() * launchQuotes.length)]);
      quoteIntervalRef.current = setInterval(() => {
        setLaunchQuote(launchQuotes[Math.floor(Math.random() * launchQuotes.length)]);
      }, 5000);
    } else {
      if (quoteIntervalRef.current) clearInterval(quoteIntervalRef.current);
    }
    return () => { if (quoteIntervalRef.current) clearInterval(quoteIntervalRef.current); };
  }, [isLaunching]);

  // Template create/edit sheet state
  type TemplateSheetState =
    | { type: 'campaign'; template: CampaignTemplate; isNew: boolean; onSelect?: (id: string) => void }
    | { type: 'adset'; template: AdsetTemplate; isNew: boolean; onSelect?: (id: string) => void }
    | { type: 'ad'; template: AdTemplate; isNew: boolean; onSelect?: (id: string) => void }
    | { type: 'advantage'; template: AdvantageCreativeTemplate; isNew: boolean; onSelect?: (id: string) => void }
    | null;
  const [templateSheet, setTemplateSheet] = useState<TemplateSheetState>(null);

  const { organizationId } = useAuth();
  const { data: adAccounts } = useAdAccounts();
  const selectedAccount = adAccounts?.find(a => a.accountId === accountId);
  const missingAccountFields = getMissingAccountFields(selectedAccount);
  const isAccountIncomplete = !!selectedAccount && missingAccountFields.length > 0;
  const { data: leadForms, isLoading: leadFormsLoading } = useLeadForms(accountId, selectedAccount?.pageId);

  const campaignStore = useTemplateStore<CampaignTemplate>('campaign-templates');
  const adsetStore = useTemplateStore<AdsetTemplate>('adset-templates');
  const adStore = useTemplateStore<AdTemplate>('ad-templates');
  const advantageStore = useTemplateStore<AdvantageCreativeTemplate>('advantage-creative-templates');

  const updateAdSet = (adSetId: string, updates: Partial<AdSetEntry>) => {
    setAdSets(sets => sets.map(s => s.id === adSetId ? { ...s, ...updates } : s));
  };

  const updateAd = (adSetId: string, adId: string, updates: Partial<AdEntry>) => {
    setAdSets(sets => sets.map(s =>
      s.id === adSetId
        ? { ...s, ads: s.ads.map(a => a.id === adId ? { ...a, ...updates } : a) }
        : s
    ));
  };

  const addAd = (adSetId: string) => {
    setAdSets(sets => sets.map(s =>
      s.id === adSetId
        ? { ...s, ads: [...s.ads, createAd(s.ads.length + 1)] }
        : s
    ));
  };

  const removeAd = (adSetId: string, adId: string) => {
    setAdSets(sets => sets.map(s =>
      s.id === adSetId
        ? { ...s, ads: s.ads.filter(a => a.id !== adId) }
        : s
    ));
  };

  const duplicateAd = (adSetId: string, adId: string) => {
    setAdSets(sets => sets.map(s => {
      if (s.id !== adSetId) return s;
      const source = s.ads.find(a => a.id === adId);
      if (!source) return s;
      const copy: AdEntry = { ...source, id: crypto.randomUUID(), name: `${source.name} (copy)`, collapsed: false };
      const idx = s.ads.findIndex(a => a.id === adId);
      const newAds = [...s.ads];
      newAds.splice(idx + 1, 0, copy);
      return { ...s, ads: newAds };
    }));
  };

  const addAdSet = () => {
    setAdSets(sets => [...sets, createAdSet(sets.length + 1)]);
  };

  const removeAdSet = (adSetId: string) => {
    if (adSets.length <= 1) return;
    setAdSets(sets => sets.filter(s => s.id !== adSetId));
  };

  const duplicateAdSet = (adSetId: string) => {
    setAdSets(sets => {
      const source = sets.find(s => s.id === adSetId);
      if (!source) return sets;
      const copy: AdSetEntry = {
        ...source,
        id: crypto.randomUUID(),
        name: `${source.name} (copy)`,
        collapsed: false,
        ads: source.ads.map(a => ({ ...a, id: crypto.randomUUID() })),
      };
      const idx = sets.findIndex(s => s.id === adSetId);
      const newSets = [...sets];
      newSets.splice(idx + 1, 0, copy);
      return newSets;
    });
  };

  const handleDocumentImport = (data: ParsedDocument) => {
    // Auto-fill campaign name from document filename
    const docName = data.fileName.replace(/\.docx$/i, '').replace(/[_-]/g, ' ');
    if (!campaignName) {
      setCampaignName(docName);
    }
    setCampaignType('new');

    // Map each parsed campaign to an ad set, with ads containing the text variants
    const importedAdSets: AdSetEntry[] = data.campaigns.map((camp) => ({
      id: crypto.randomUUID(),
      name: `${camp.name} — ${camp.audience}`,
      type: 'new' as const,
      existingAdsetId: '',
      adsetTemplateId: '',
      collapsed: false,
      ads: camp.ads.map((ad) => ({
        id: crypto.randomUUID(),
        name: ad.name,
        productSetId: '',
        productCatalogId: null,
        urlOverride: '',
        scheduleStart: '',
        scheduleEnd: '',
        headlines: [''],
        primaryTexts: ad.primaryTexts,
        creative: createEmptyCreativeData(),
        adTemplateId: '',
        advantageCreativeId: '',
        leadFormId: '',
        collapsed: false,
      })),
    }));

    if (importedAdSets.length > 0) {
      // Replace everything — the document defines the full structure
      setAdSets(importedAdSets);
    }
  };

  const addHeadline = (adSetId: string, adId: string) => {
    setAdSets(sets => sets.map(s =>
      s.id === adSetId
        ? { ...s, ads: s.ads.map(a => a.id === adId ? { ...a, headlines: [...a.headlines, ''] } : a) }
        : s
    ));
  };

  const addPrimaryText = (adSetId: string, adId: string) => {
    setAdSets(sets => sets.map(s =>
      s.id === adSetId
        ? { ...s, ads: s.ads.map(a => a.id === adId ? { ...a, primaryTexts: [...a.primaryTexts, ''] } : a) }
        : s
    ));
  };

  const updateHeadline = (adSetId: string, adId: string, index: number, value: string) => {
    setAdSets(sets => sets.map(s =>
      s.id === adSetId
        ? { ...s, ads: s.ads.map(a => a.id === adId ? { ...a, headlines: a.headlines.map((h, i) => i === index ? value : h) } : a) }
        : s
    ));
  };

  const updatePrimaryText = (adSetId: string, adId: string, index: number, value: string) => {
    setAdSets(sets => sets.map(s =>
      s.id === adSetId
        ? { ...s, ads: s.ads.map(a => a.id === adId ? { ...a, primaryTexts: a.primaryTexts.map((t, i) => i === index ? value : t) } : a) }
        : s
    ));
  };

  const removeHeadline = (adSetId: string, adId: string, index: number) => {
    setAdSets(sets => sets.map(s =>
      s.id === adSetId
        ? { ...s, ads: s.ads.map(a => a.id === adId ? { ...a, headlines: a.headlines.filter((_, i) => i !== index) } : a) }
        : s
    ));
  };

  const removePrimaryText = (adSetId: string, adId: string, index: number) => {
    setAdSets(sets => sets.map(s =>
      s.id === adSetId
        ? { ...s, ads: s.ads.map(a => a.id === adId ? { ...a, primaryTexts: a.primaryTexts.filter((_, i) => i !== index) } : a) }
        : s
    ));
  };

  const handleStartCampaign = async () => {
    // Validation
    if (!accountId) { toast.error('Please select an ad account'); return; }
    if (isAccountIncomplete) {
      toast.error(`This account is missing: ${missingAccountFields.join(', ')}. Configure it in the main app before launching.`);
      return;
    }
    if (campaignType === 'new' && !campaignName.trim()) { toast.error('Please enter a campaign name'); return; }
    if (campaignType === 'existing' && !existingCampaignId.trim()) { toast.error('Please enter an existing campaign ID'); return; }
    if (campaignType === 'new' && !campaignTemplateId) { toast.error('Please select a campaign template'); return; }

    // Validate ad set and ad templates are selected
    for (const adSet of adSets) {
      if (adSet.type === 'new' && !adSet.adsetTemplateId) {
        toast.error(`Ad Set "${adSet.name}" has no adset template selected`);
        return;
      }
      for (const ad of adSet.ads) {
        if (!ad.adTemplateId) {
          toast.error(`Ad "${ad.name}" in "${adSet.name}" has no ad template selected`);
          return;
        }
      }
    }

    // Resolve templates
    const campaignTemplate = campaignStore.items.find(t => t.id === campaignTemplateId);
    if (campaignType === 'new' && !campaignTemplate) { toast.error('Selected campaign template not found'); return; }

    // Validate image URLs — blob: URLs can't be sent to Meta
    for (const adSet of adSets) {
      for (const ad of adSet.ads) {
        if (ad.creative.type === 'SINGLE_IMAGE' && ad.creative.singleImage?.squareUrl) {
          if (ad.creative.singleImage.squareUrl.startsWith('blob:')) {
            toast.error(`Ad "${ad.name}" has a local image. Enable Cloudinary or paste an HTTPS image URL before launching.`);
            return;
          }
        }
        if (ad.creative.type === 'SINGLE_VIDEO' && ad.creative.singleVideo?.url) {
          if (ad.creative.singleVideo.url.startsWith('blob:')) {
            toast.error(`Ad "${ad.name}" has a local video. Enable Cloudinary or paste an HTTPS video URL before launching.`);
            return;
          }
        }
        if (ad.creative.type === 'CAROUSEL') {
          const blobCard = ad.creative.carouselCards.find(c => c.image.squareUrl.startsWith('blob:'));
          if (blobCard) {
            toast.error(`Ad "${ad.name}" has carousel cards with local images. Enable Cloudinary or paste HTTPS image URLs before launching.`);
            return;
          }
        }

        // Multi-variant requires a 9:16 story variant for every image
        if (ad.creative.multiVariant) {
          if (ad.creative.type === 'SINGLE_IMAGE' && ad.creative.singleImage?.squareUrl) {
            const hasStory = ad.creative.singleImage.storyVariants.length > 0 && ad.creative.singleImage.selectedStoryId;
            if (!hasStory) {
              toast.error(`Ad "${ad.name}" has multi-variant enabled but no 9:16 story image selected. Upload via Cloudinary or provide a 9:16 URL.`);
              return;
            }
          }
          if (ad.creative.type === 'CAROUSEL') {
            const missingCard = ad.creative.carouselCards.find(
              c => c.image.squareUrl && (!c.image.storyVariants.length || !c.image.selectedStoryId)
            );
            if (missingCard) {
              toast.error(`Ad "${ad.name}" card "${missingCard.title}" has multi-variant enabled but no 9:16 story image. Upload via Cloudinary or provide a 9:16 URL.`);
              return;
            }
          }
        }
      }
    }

    // Validate ad template URLs — empty URLs cause Meta API failures
    for (const adSet of adSets) {
      for (const ad of adSet.ads) {
        const adTemplate = adStore.items.find(t => t.id === ad.adTemplateId);
        if (adTemplate && !adTemplate.conversionDomain?.trim()) {
          toast.error(`Ad "${ad.name}" in "${adSet.name}" — the selected ad template has no URL configured. Add a URL in the template first.`);
          return;
        }
      }
    }

    // Validate dynamic creative constraints
    for (const adSet of adSets) {
      if (adSet.type !== 'new') continue;
      const adsetTemplate = adsetStore.items.find(t => t.id === adSet.adsetTemplateId);
      const isDynamic = adsetTemplate?.dynamicCreative;

      if (isDynamic) {
        // Meta only allows 1 ad per dynamic creative ad set
        if (adSet.ads.length > 1) {
          toast.error(`"${adSet.name}" has Dynamic Creative enabled but contains ${adSet.ads.length} ads. Meta allows only 1 ad per dynamic creative ad set. Remove extra ads or disable Dynamic Creative on the adset template.`);
          return;
        }
      }
      // Note: Multi-text without Dynamic Creative is allowed when multi-variant is ON
      // (asset_feed_spec handles multiple texts via shared adlabels + placement optimization).
      // When multi-variant is OFF and multi-text exists, is_dynamic_creative will be auto-set
      // in campaignService.ts based on the ad content.
    }

    setIsLaunching(true);
    try {
      const payload: Record<string, unknown> = {
        account_id: accountId,
        organization_id: organizationId,
        page_id: selectedAccount?.pageId || null,
        pixel_id: selectedAccount?.pixelId || null,
        instagram_id: selectedAccount?.instagramId || null,
        campaign_type: campaignType,
      };

      if (campaignType === 'existing') {
        payload.existing_campaign_id = existingCampaignId;
      }

      if (campaignType === 'new' && campaignTemplate) {
        payload.campaign = {
          name: campaignName,
          objective: campaignTemplate.campaignObjective,
          buying_type: campaignTemplate.buyingType,
          bid_strategy: campaignTemplate.bidStrategy,
          bid_amount: campaignTemplate.bidAmount,
          advantage_campaign_budget: campaignTemplate.advantageCampaignBudget,
          campaign_budget_type: campaignTemplate.campaignBudgetType,
          campaign_budget_value: campaignTemplate.campaignBudgetValue,
          special_ad_categories: campaignTemplate.specialAdCategories || [],
          advantage_plus_catalog: campaignTemplate.advantagePlusCatalog || false,
          catalog_id: campaignTemplate.catalogId || null,
        };
      }

      payload.ad_sets = adSets.map(adSet => {
        const adsetTemplate = adsetStore.items.find(t => t.id === adSet.adsetTemplateId);
        return {
          type: adSet.type,
          name: adSet.name,
          existing_adset_id: adSet.type === 'existing' ? adSet.existingAdsetId : undefined,
          template_fields: adsetTemplate ? {
            placements: adsetTemplate.placements,
            placementOptions: adsetTemplate.placementOptions,
            targetGender: adsetTemplate.targetGender,
            targetAge: adsetTemplate.targetAge,
            location: adsetTemplate.location,
            adsetConversionLocation: adsetTemplate.adsetConversionLocation,
            pixelId: adsetTemplate.pixelId || selectedAccount?.pixelId,
            adsetBudgetType: adsetTemplate.adsetBudgetType,
            adsetBudgetValue: adsetTemplate.adsetBudgetValue,
            bidStrategy: adsetTemplate.bidStrategy,
            bidAmount: adsetTemplate.bidAmount,
            attributionSetting: adsetTemplate.attributionSetting,
            dynamicCreative: adsetTemplate.dynamicCreative,
            startDate: adsetTemplate.startDate,
            setEndDate: adsetTemplate.setEndDate,
            endDate: adsetTemplate.endDate,
          } : {},
          ads: adSet.ads.map(ad => {
            const adTemplate = adStore.items.find(t => t.id === ad.adTemplateId);
            const advantageTemplate = advantageStore.items.find(t => t.id === ad.advantageCreativeId);
            return {
              name: ad.name,
              creative_type: ad.creative.type,
              headlines: ad.headlines.filter(h => h.trim()),
              primary_texts: ad.primaryTexts.filter(t => t.trim()),
              url: ad.urlOverride.trim() || adTemplate?.conversionDomain || '',
              call_to_action: adTemplate?.callToAction || 'SHOP_NOW',
              url_parameters: adTemplate?.urlParameters || '',
              lead_form_id: ad.leadFormId || null,
              product_set_id: ad.productSetId.trim() || null,
              product_catalog_id: ad.productCatalogId || null,
              square_image_url: ad.creative.type === 'SINGLE_IMAGE'
                ? (ad.creative.singleImage?.squareUrl || null)
                : null,
              story_image_url: ad.creative.type === 'SINGLE_IMAGE'
                ? (ad.creative.singleImage?.storyVariants.find(v => v.id === ad.creative.singleImage?.selectedStoryId)?.url || null)
                : null,
              video_url: ad.creative.type === 'SINGLE_VIDEO'
                ? (ad.creative.singleVideo?.url || null)
                : null,
              video_file_name: ad.creative.type === 'SINGLE_VIDEO'
                ? (ad.creative.singleVideo?.fileName || null)
                : null,
              thumbnail_url: ad.creative.type === 'SINGLE_VIDEO'
                ? (ad.creative.singleVideo?.thumbnailUrl || null)
                : null,
              story_video_url: ad.creative.type === 'SINGLE_VIDEO' && ad.creative.multiVariant
                ? (ad.creative.singleVideo?.storyUrl || null)
                : null,
              story_video_file_name: ad.creative.type === 'SINGLE_VIDEO' && ad.creative.multiVariant
                ? (ad.creative.singleVideo?.storyFileName || null)
                : null,
              story_thumbnail_url: ad.creative.type === 'SINGLE_VIDEO' && ad.creative.multiVariant
                ? (ad.creative.singleVideo?.storyThumbnailUrl || null)
                : null,
              ad_schedule_start_time: toMetaScheduleTime(ad.scheduleStart),
              ad_schedule_end_time: toMetaScheduleTime(ad.scheduleEnd),
              carousel_cards: ad.creative.type === 'CAROUSEL'
                ? ad.creative.carouselCards
                  .filter(c => c.image.squareUrl)
                  .map(c => ({
                    title: c.title,
                    url: c.url,
                    image_url: c.image.squareUrl,
                    story_image_url: c.image.storyVariants.find(
                      v => v.id === c.image.selectedStoryId
                    )?.url || null,
                  }))
                : [],
              advantage_creative_config: advantageTemplate ? (() => {
                const s = (on: boolean) => ({ enroll_status: on ? 'OPT_IN' : 'OPT_OUT' });
                const creativeType = ad.creative.type;
                const img = advantageTemplate.imageEnhancements;
                const vid = advantageTemplate.videoEnhancements;
                const car = advantageTemplate.carouselEnhancements;
                const cat = advantageTemplate.catalogEnhancements;
                const hasCatalog = !!ad.productSetId.trim();

                let features: Record<string, { enroll_status: string }> = {};

                if (creativeType === 'SINGLE_IMAGE') {
                  features = {
                    image_touchups:                s(img.visualTouchups),
                    image_brightness_and_contrast: s(img.adjustBrightnessContrast),
                    text_translation:              s(img.textTranslation),
                    image_animation:               s(img.imageAnimation),
                    pac_relaxation:                s(img.flexibleMedia),
                    enhance_cta:                   s(img.enhanceCta),
                    image_templates:               s(img.addOverlays),
                    image_uncrop:                  s(img.expandImage),
                    text_optimizations:            s(img.textImprovements),
                    inline_comment:                s(img.relevantComments),
                    product_extensions:            s(img.addProductTags || img.addCatalogItems),
                  };
                } else if (creativeType === 'SINGLE_VIDEO') {
                  features = {
                    video_auto_crop:   s(vid.visualTouchups),
                    video_highlights:  s(vid.videoEffects),
                    text_translation:  s(vid.textTranslation),
                    video_to_image:    s(vid.videoToImage),
                    pac_relaxation:    s(vid.flexibleMedia),
                    enhance_cta:       s(vid.enhanceCta),
                    text_optimizations: s(vid.textImprovements),
                    inline_comment:    s(vid.relevantComments),
                    product_extensions: s(vid.addProductTags || vid.addCatalogItems),
                  };
                } else if (creativeType === 'CAROUSEL') {
                  features = {
                    media_type_automation: s(car.formatAutomation),
                    multi_photo_to_video:  s(car.photosToVideo),
                    media_order:           s(car.highlightCard),
                    description_automation: s(car.dynamicDescription),
                    profile_card:          s(car.profileEndCard),
                    image_uncrop:          s(car.expandImage),
                    image_templates:       s(car.addOverlays),
                    enhance_cta:           s(car.enhanceCta),
                    text_optimizations:    s(car.textImprovements),
                    inline_comment:        s(car.relevantComments),
                  };
                }

                // Catalog-specific features — layered on when the ad uses a product set
                if (hasCatalog && cat) {
                  features.adapt_to_placement    = s(cat.adaptToPlacement);
                  features.media_type_automation = s(cat.dynamicMedia);
                  features.description_automation = s(cat.dynamicDescription);
                  features.add_text_overlay      = s(cat.dynamicOverlays);
                  features.image_background_gen  = s(cat.generateBackground);
                  features.site_extensions       = s(cat.siteLinks);
                }

                return Object.keys(features).length > 0 ? features : null;
              })() : null,
              // Music — lives in asset_feed_spec.audios, not creative_features_spec.
              // Only works on asset_feed_spec ads (multi-text or story variant).
              enable_music: advantageTemplate ? (() => {
                const creativeType = ad.creative.type;
                if (creativeType === 'SINGLE_IMAGE') return !!advantageTemplate.imageEnhancements.music;
                if (creativeType === 'SINGLE_VIDEO') return !!advantageTemplate.videoEnhancements.music;
                return false;
              })() : false,
            };
          }),
        };
      });

      const result: LaunchResult = await launchCampaign(payload);

      // Count results — ad sets AND ads
      let createdAdSets = 0;
      let failedAdSets = 0;
      let createdAds = 0;
      let failedAds = 0;
      const errors: string[] = [];

      for (const adSet of result.ad_sets) {
        if (adSet.status === 'CREATED' || adSet.status === 'EXISTING') {
          createdAdSets++;
        } else if (adSet.status === 'FAILED') {
          failedAdSets++;
          if (adSet.error) errors.push(`Ad Set "${adSet.name}": ${adSet.error}`);
        }
        for (const ad of adSet.ads) {
          if (ad.status === 'CREATED') createdAds++;
          else {
            failedAds++;
            if (ad.error) errors.push(`Ad "${ad.name}": ${ad.error}`);
          }
        }
      }

      if (failedAdSets > 0 || failedAds > 0) {
        const parts = [];
        if (createdAdSets > 0) parts.push(`${createdAdSets} ad sets created`);
        if (failedAdSets > 0) parts.push(`${failedAdSets} ad sets failed`);
        if (createdAds > 0) parts.push(`${createdAds} ads created`);
        if (failedAds > 0) parts.push(`${failedAds} ads failed`);
        toast.warning(`Campaign launched with issues: ${parts.join(', ')}`, {
          description: errors.length > 0 ? errors[0] : undefined,
          duration: 10000,
        });
        // Log all errors for debugging
        if (errors.length > 0) {
          console.error('[Campaign Errors]', errors);
        }
      } else {
        toast.success(`Campaign launched! ${createdAdSets} ad sets, ${createdAds} ads created`);
      }
    } catch (err) {
      toast.error(`Campaign launch failed: ${(err as Error).message}`);
    } finally {
      setIsLaunching(false);
    }
  };

  // --- Template sheet helpers ---
  const openCreateCampaignTemplate = () => {
    setTemplateSheet({
      type: 'campaign',
      template: { ...createEmptyCampaignTemplate(), id: crypto.randomUUID(), createdAt: new Date().toISOString() } as CampaignTemplate,
      isNew: true,
      onSelect: setCampaignTemplateId,
    });
  };
  const openEditCampaignTemplate = () => {
    const tpl = campaignStore.items.find(t => t.id === campaignTemplateId);
    if (tpl) setTemplateSheet({ type: 'campaign', template: tpl, isNew: false });
  };
  const openCreateAdsetTemplate = (adSetId: string) => {
    setTemplateSheet({
      type: 'adset',
      template: { ...createEmptyAdsetTemplate(), id: crypto.randomUUID(), createdAt: new Date().toISOString() } as AdsetTemplate,
      isNew: true,
      onSelect: (id) => updateAdSet(adSetId, { adsetTemplateId: id }),
    });
  };
  const openEditAdsetTemplate = (adsetTemplateId: string) => {
    const tpl = adsetStore.items.find(t => t.id === adsetTemplateId);
    if (tpl) setTemplateSheet({ type: 'adset', template: tpl, isNew: false });
  };
  const openCreateAdTemplate = (adSetId: string, adId: string) => {
    setTemplateSheet({
      type: 'ad',
      template: { ...createEmptyAdTemplate(), id: crypto.randomUUID(), createdAt: new Date().toISOString() } as AdTemplate,
      isNew: true,
      onSelect: (id) => updateAd(adSetId, adId, { adTemplateId: id }),
    });
  };
  const openEditAdTemplate = (adTemplateId: string) => {
    const tpl = adStore.items.find(t => t.id === adTemplateId);
    if (tpl) setTemplateSheet({ type: 'ad', template: tpl, isNew: false });
  };
  const openCreateAdvantageTemplate = (adSetId: string, adId: string) => {
    setTemplateSheet({
      type: 'advantage',
      template: { ...createEmptyAdvantageCreativeTemplate(), id: crypto.randomUUID(), createdAt: new Date().toISOString() } as AdvantageCreativeTemplate,
      isNew: true,
      onSelect: (id) => updateAd(adSetId, adId, { advantageCreativeId: id }),
    });
  };
  const openEditAdvantageTemplate = (advantageId: string) => {
    const tpl = advantageStore.items.find(t => t.id === advantageId);
    if (tpl) setTemplateSheet({ type: 'advantage', template: tpl, isNew: false });
  };
  const handleTemplateSave = (template: CampaignTemplate | AdsetTemplate | AdTemplate | AdvantageCreativeTemplate) => {
    if (!templateSheet) return;
    if (templateSheet.type === 'campaign') {
      const t = template as CampaignTemplate;
      if (templateSheet.isNew) {
        campaignStore.add(t);
        templateSheet.onSelect?.(t.id);
        toast.success(`Template "${t.name}" created`);
      } else {
        campaignStore.update(t.id, t);
        toast.success(`Template "${t.name}" updated`);
      }
    } else if (templateSheet.type === 'adset') {
      const t = template as AdsetTemplate;
      if (templateSheet.isNew) {
        adsetStore.add(t);
        templateSheet.onSelect?.(t.id);
        toast.success(`Template "${t.name}" created`);
      } else {
        adsetStore.update(t.id, t);
        toast.success(`Template "${t.name}" updated`);
      }
    } else if (templateSheet.type === 'ad') {
      const t = template as AdTemplate;
      if (templateSheet.isNew) {
        adStore.add(t);
        templateSheet.onSelect?.(t.id);
        toast.success(`Template "${t.name}" created`);
      } else {
        adStore.update(t.id, t);
        toast.success(`Template "${t.name}" updated`);
      }
    } else if (templateSheet.type === 'advantage') {
      const t = template as AdvantageCreativeTemplate;
      if (templateSheet.isNew) {
        advantageStore.add(t);
        templateSheet.onSelect?.(t.id);
        toast.success(`Template "${t.name}" created`);
      } else {
        advantageStore.update(t.id, t);
        toast.success(`Template "${t.name}" updated`);
      }
    }
    setTemplateSheet(null);
  };

  // --- Readiness checklist computation ---
  const readinessItems: { label: string; done: boolean }[] = [];
  readinessItems.push({ label: 'Account selected', done: !!accountId });
  if (selectedAccount) {
    readinessItems.push({
      label: isAccountIncomplete
        ? `Account missing: ${missingAccountFields.join(', ')}`
        : 'Account fully configured',
      done: !isAccountIncomplete,
    });
  }
  // For new campaigns we need a name + template; for existing campaigns we
  // need the ID of the campaign in Meta to attach the new ad sets/ads to.
  if (campaignType === 'new') {
    readinessItems.push({ label: 'Campaign name', done: !!campaignName.trim() });
    readinessItems.push({ label: 'Campaign template', done: !!campaignTemplateId });
  } else {
    readinessItems.push({ label: 'Existing Campaign ID', done: !!existingCampaignId.trim() });
  }
  adSets.forEach((adSet, si) => {
    const setLabel = `Ad Set ${si + 1}`;
    if (adSet.type === 'new') {
      readinessItems.push({ label: `${setLabel} — name`, done: !!adSet.name.trim() });
      readinessItems.push({ label: `${setLabel} — template`, done: !!adSet.adsetTemplateId });
    } else {
      // Existing ad set: only the Meta ad set ID matters — name/template
      // belong to the ad set already in Meta, we just attach new ads to it.
      readinessItems.push({ label: `${setLabel} — existing ID`, done: !!adSet.existingAdsetId.trim() });
    }
    adSet.ads.forEach((ad, ai) => {
      const adLabel = `Ad ${ai + 1}`;
      readinessItems.push({ label: `${adLabel} — template`, done: !!ad.adTemplateId });
      readinessItems.push({ label: `${adLabel} — headline`, done: ad.headlines.some(h => h.trim()) });
      readinessItems.push({
        label: `${adLabel} — creative`,
        done:
          (ad.creative.type === 'SINGLE_IMAGE' && !!ad.creative.singleImage?.squareUrl) ||
          (ad.creative.type === 'SINGLE_VIDEO' && !!ad.creative.singleVideo?.url) ||
          (ad.creative.type === 'CAROUSEL' && ad.creative.carouselCards.some(c => !!c.image.squareUrl)),
      });
    });
  });
  const completedCount = readinessItems.filter(i => i.done).length;
  const totalCount = readinessItems.length;

  return (
    <AppLayout>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border px-8 py-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Campaign Builder</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Create and configure your Meta ad campaigns</p>
          </div>
          {/* Mobile-only Start Campaign (hidden on lg where sidebar shows) */}
          <Button
            onClick={handleStartCampaign}
            disabled={isLaunching || completedCount < totalCount}
            className="lg:hidden bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold px-6 shadow-lg shadow-primary/20 rounded-xl"
          >
            {isLaunching ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Rocket className="w-4 h-4 mr-2" /> Start Campaign</>}
          </Button>
        </div>
      </div>

      <div className="flex gap-6 px-8 py-6">
        {/* Left: form content (scrollable) */}
        <div className="flex-1 min-w-0 space-y-6">

        {/* Document Import */}
        <Card className="animate-fade-in">
          <div
            className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-accent/30 transition-colors rounded-t-xl"
            onClick={() => setDocImportOpen(!docImportOpen)}
          >
            <div>
              <h3 className="text-sm font-bold text-foreground">Document Import</h3>
              <p className="text-xs text-muted-foreground">Auto-populate campaign structure from files</p>
            </div>
            {docImportOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
          <div className={`overflow-hidden transition-all duration-300 ${docImportOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <CardContent className="pt-0 pb-6">
              <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5 items-stretch">
                {/* Left 2/3: Upload zone — stretches to match right side */}
                <DocumentImport onImport={handleDocumentImport} />
                {/* Right 1/3: Description + instructions */}
                <div className="flex flex-col gap-3">
                  <div className="bg-accent/30 rounded-xl p-4 border border-primary/10">
                    <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2">How it works</h4>
                    <ul className="text-[11px] text-muted-foreground space-y-1 leading-relaxed">
                      <li>• Upload a <strong>.docx</strong> with ad texts</li>
                      <li>• Auto-detects campaigns, ad sets & variants</li>
                      <li>• Fields below are pre-filled for you</li>
                    </ul>
                  </div>
                  <div className="flex-1">
                    <Label className="text-[10px] text-muted-foreground uppercase font-medium">Additional Instructions</Label>
                    <textarea
                      className="mt-1.5 w-full h-[calc(100%-24px)] min-h-[80px] rounded-lg border border-border bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      placeholder={"Add context to improve accuracy:\n• \"Headlines in column A\"\n• \"2 audiences per campaign\"\n• \"Ignore summary table\""}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>

        {/* 1. Campaign Setup */}
        <Card className="animate-fade-in">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Campaign Setup</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <AccountSelector value={accountId} onChange={setAccountId} />
              <div className={cn('transition-opacity', isAccountIncomplete && 'pointer-events-none opacity-40')}>
                <Label className="text-xs text-muted-foreground uppercase font-medium">Campaign Type</Label>
                <div className="flex mt-2 bg-muted rounded-xl p-1">
                  <button
                    onClick={() => {
                      setCampaignType('new');
                      // Reset all ad sets to "new" since existing ad sets can't be added to new campaigns
                      setAdSets(sets => sets.map(s => ({ ...s, type: 'new' as const })));
                    }}
                    className={cn(
                      'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200',
                      campaignType === 'new'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    New
                  </button>
                  <button
                    onClick={() => setCampaignType('existing')}
                    className={cn(
                      'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200',
                      campaignType === 'existing'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Existing
                  </button>
                </div>
              </div>
            </div>

            {isAccountIncomplete && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 animate-fade-in">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-destructive">Account setup incomplete</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      <span className="font-semibold text-foreground">{selectedAccount?.name}</span> cannot be used to launch campaigns until the following fields are configured on the ad account:
                    </p>
                    <ul className="mt-2 space-y-1">
                      {missingAccountFields.map(field => (
                        <li key={field} className="flex items-center gap-2 text-xs">
                          <span className="w-1 h-1 rounded-full bg-destructive" />
                          <span className="font-mono text-destructive">{field}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                      Add these fields in the main app's ad account settings, then reload this page. All campaign fields below are locked until the setup is complete.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className={cn('space-y-4 transition-opacity', isAccountIncomplete && 'pointer-events-none opacity-40 select-none')}>
            {campaignType === 'new' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Campaign Name</Label>
                    <Input
                      value={campaignName}
                      onChange={e => setCampaignName(e.target.value)}
                      placeholder="Enter a campaign name"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase font-medium">Template</Label>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Select value={campaignTemplateId} onValueChange={setCampaignTemplateId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Campaign Template" />
                        </SelectTrigger>
                        <SelectContent>
                          {campaignStore.items.length === 0 ? (
                            <SelectItem value="_none" disabled>No templates available</SelectItem>
                          ) : (
                            campaignStore.items.map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-primary/30 text-primary hover:bg-primary/10" title="Create new template" onClick={openCreateCampaignTemplate}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-primary/30 text-primary hover:bg-primary/10" disabled={!campaignTemplateId} title="Edit selected template" onClick={openEditCampaignTemplate}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="max-w-md">
                <Label>Existing Campaign</Label>
                <Combobox
                  options={(existingCampaigns || []).map(c => ({
                    value: c.id,
                    label: c.status && c.status !== 'ACTIVE' ? `${c.name} · ${c.status}` : c.name,
                  }))}
                  value={existingCampaignId}
                  onChange={setExistingCampaignId}
                  placeholder={accountId ? 'Select a campaign...' : 'Select an ad account first'}
                  searchPlaceholder="Search by name..."
                  emptyText={loadingCampaigns ? 'Loading...' : 'No campaigns found'}
                  loading={loadingCampaigns}
                  disabled={!accountId}
                  className="mt-1.5"
                />
              </div>
            )}
            </div>
          </CardContent>
        </Card>

        {/* 2. Ad Sets & Ads */}
        <div className={cn('transition-opacity', isAccountIncomplete && 'pointer-events-none opacity-40 select-none')}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</div>
              <h2 className="text-sm font-bold uppercase tracking-wider">Ad Sets & Ads</h2>
            </div>
            <span className="text-xs text-primary font-medium">{adSets.length} Ad Set{adSets.length !== 1 ? 's' : ''} Configured</span>
          </div>

          <div className="space-y-6">
            {adSets.map((adSet, adSetIndex) => (
              <Card key={adSet.id} className="border-primary/30 animate-fade-in">
                <CardContent className="pt-6 space-y-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => updateAdSet(adSet.id, { collapsed: !adSet.collapsed })}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-8 rounded-full bg-primary" />
                      <span className="font-bold text-sm">Ad Set {adSetIndex + 1}{adSet.name ? `: ${adSet.name}` : ''}</span>
                      {adSet.adsetTemplateId && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">TEMPLATE</Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">{adSet.ads.length} ADS</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); duplicateAdSet(adSet.id); }} className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <Copy className="w-4 h-4" />
                      </Button>
                      {adSets.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeAdSet(adSet.id); }} className="text-destructive hover:text-destructive h-8 w-8">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      {adSet.collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </div>
                  </div>

                  <div className={`overflow-hidden transition-all duration-300 ${adSet.collapsed ? 'max-h-0 opacity-0' : 'max-h-[9999px] opacity-100'}`}>
                  <div className="space-y-4">

                  <div className={cn("grid gap-4", campaignType === 'existing' ? 'grid-cols-3' : 'grid-cols-2')}>
                    {campaignType === 'existing' && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Ad Set Type</Label>
                        <div className="flex mt-1.5 bg-muted rounded-xl p-1">
                          <button
                            onClick={() => updateAdSet(adSet.id, { type: 'new' })}
                            className={cn(
                              'flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all duration-200',
                              adSet.type === 'new'
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            New
                          </button>
                          <button
                            onClick={() => updateAdSet(adSet.id, { type: 'existing' })}
                            className={cn(
                              'flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all duration-200',
                              adSet.type === 'existing'
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            Existing
                          </button>
                        </div>
                      </div>
                    )}
                    {adSet.type === 'new' ? (
                      <div>
                        <Label className="text-xs text-muted-foreground">Ad Set Name</Label>
                        <Input
                          value={adSet.name}
                          onChange={e => updateAdSet(adSet.id, { name: e.target.value })}
                          placeholder="Enter an ad set name"
                          className="mt-1.5"
                        />
                      </div>
                    ) : (
                      <div>
                        <Label className="text-xs text-muted-foreground">Existing Ad Set</Label>
                        <Combobox
                          options={(existingAdSets || [])
                            .filter(as => !existingCampaignId || as.campaign_id === existingCampaignId)
                            .map(as => ({
                              value: as.id,
                              label: as.status && as.status !== 'ACTIVE' ? `${as.name} · ${as.status}` : as.name,
                            }))}
                          value={adSet.existingAdsetId}
                          onChange={v => updateAdSet(adSet.id, { existingAdsetId: v })}
                          placeholder={accountId ? 'Select an ad set...' : 'Select an ad account first'}
                          searchPlaceholder="Search by name..."
                          emptyText={loadingAdSets ? 'Loading...' : (existingCampaignId ? 'No ad sets in this campaign' : 'No ad sets found')}
                          loading={loadingAdSets}
                          disabled={!accountId}
                          className="mt-1.5"
                        />
                        {!existingCampaignId && (
                          <p className="text-[10px] text-amber-600 mt-1">Pick a campaign above to narrow the list.</p>
                        )}
                      </div>
                    )}
                    {adSet.type === 'new' && (
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase font-medium">Adset Template</Label>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Select value={adSet.adsetTemplateId} onValueChange={v => updateAdSet(adSet.id, { adsetTemplateId: v })}>
                          <SelectTrigger className="bg-primary/10 border-primary/30 text-foreground">
                            <SelectValue placeholder="Select Adset Template" />
                          </SelectTrigger>
                          <SelectContent>
                            {adsetStore.items.length === 0 ? (
                              <SelectItem value="_none" disabled>No templates</SelectItem>
                            ) : (
                              adsetStore.items.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-primary/30 text-primary hover:bg-primary/10" title="Create new template" onClick={() => openCreateAdsetTemplate(adSet.id)}>
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-primary/30 text-primary hover:bg-primary/10" disabled={!adSet.adsetTemplateId} title="Edit selected template" onClick={() => openEditAdsetTemplate(adSet.adsetTemplateId)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    )}
                  </div>

                  <hr className="border-border" />

                  <p className="text-sm text-muted-foreground font-medium">Ads Setup</p>

                  <div className="space-y-4">
                    {adSet.ads.map((ad, adIndex) => (
                      <Card key={ad.id} className="border-primary/20 bg-muted/30">
                        <CardContent className="pt-4 space-y-4">
                          {/* Ad Header */}
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-primary">Ad {adIndex + 1}: {ad.name}</h4>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => duplicateAd(adSet.id, ad.id)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => removeAd(adSet.id, ad.id)} className="text-destructive hover:text-destructive h-8 w-8">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => updateAd(adSet.id, ad.id, { collapsed: !ad.collapsed })} className="h-8 w-8">
                                {ad.collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                              </Button>
                            </div>
                          </div>

                          {!ad.collapsed && (
                            <>
                              {/* Ad Name & Product Set */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Ad Name</Label>
                                  <Input value={ad.name} onChange={e => updateAd(adSet.id, ad.id, { name: e.target.value })} className="mt-1" />
                                </div>
                                <ProductSetField
                                  accountId={accountId}
                                  catalogId={campaignStore.items.find(t => t.id === campaignTemplateId)?.catalogId}
                                  value={ad.productSetId}
                                  onChange={(productSetId, productCatalogId) =>
                                    updateAd(adSet.id, ad.id, { productSetId, productCatalogId })
                                  }
                                />
                              </div>

                              {/* Lead Form — shown when adset conversion location is "On Ad" */}
                              {(() => {
                                const adsetTpl = adsetStore.items.find(t => t.id === adSet.adsetTemplateId);
                                if (adsetTpl?.adsetConversionLocation !== 'On Ad') return null;
                                return (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Lead Form</Label>
                                    {leadForms && leadForms.length > 0 ? (
                                      <Select value={ad.leadFormId} onValueChange={v => updateAd(adSet.id, ad.id, { leadFormId: v })}>
                                        <SelectTrigger className="mt-1">
                                          <SelectValue placeholder={leadFormsLoading ? 'Loading forms...' : 'Select a lead form'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {leadForms.map(form => (
                                            <SelectItem key={form.id} value={form.id}>
                                              {form.name} ({form.status})
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Input value={ad.leadFormId} onChange={e => updateAd(adSet.id, ad.id, { leadFormId: e.target.value })} placeholder={leadFormsLoading ? 'Loading...' : 'Enter Lead Form ID'} className="mt-1" />
                                    )}
                                  </div>
                                );
                              })()}

                              {/* Template Selectors */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs text-muted-foreground uppercase font-medium">Ad Template</Label>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <Select value={ad.adTemplateId} onValueChange={v => updateAd(adSet.id, ad.id, { adTemplateId: v })}>
                                      <SelectTrigger><SelectValue placeholder="Select Ad Template" /></SelectTrigger>
                                      <SelectContent>
                                        {adStore.items.length === 0 ? (
                                          <SelectItem value="_none" disabled>No templates</SelectItem>
                                        ) : adStore.items.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-primary/30 text-primary hover:bg-primary/10" title="Create new template" onClick={() => openCreateAdTemplate(adSet.id, ad.id)}>
                                      <Plus className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-primary/30 text-primary hover:bg-primary/10" disabled={!ad.adTemplateId} title="Edit selected template" onClick={() => openEditAdTemplate(ad.adTemplateId)}>
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground uppercase font-medium">Advantage+ Creative</Label>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <Select value={ad.advantageCreativeId} onValueChange={v => updateAd(adSet.id, ad.id, { advantageCreativeId: v === '_none' ? '' : v })}>
                                      <SelectTrigger><SelectValue placeholder="Select Advantage+ Template" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="_none">None (Meta defaults)</SelectItem>
                                        {advantageStore.items.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-primary/30 text-primary hover:bg-primary/10" title="Create new template" onClick={() => openCreateAdvantageTemplate(adSet.id, ad.id)}>
                                      <Plus className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-primary/30 text-primary hover:bg-primary/10" disabled={!ad.advantageCreativeId} title="Edit selected template" onClick={() => openEditAdvantageTemplate(ad.advantageCreativeId)}>
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              {/* Headlines */}
                              <div>
                                <Label className="text-sm font-medium">Headlines</Label>
                                <div className="space-y-2 mt-1.5">
                                  {ad.headlines.map((h, i) => (
                                    <div key={i} className="flex gap-2 items-center">
                                      <Input value={h} onChange={e => updateHeadline(adSet.id, ad.id, i, e.target.value)} placeholder={`Headline ${i + 1}`} className="flex-1" />
                                      {ad.headlines.length > 1 && (
                                        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive hover:text-destructive" onClick={() => removeHeadline(adSet.id, ad.id, i)}>
                                          <X className="w-3.5 h-3.5" />
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <Button variant="link" size="sm" onClick={() => addHeadline(adSet.id, ad.id)} className="text-primary px-0 mt-1">
                                  + Add headline
                                </Button>
                              </div>

                              {/* Primary Texts */}
                              <div>
                                <Label className="text-sm font-medium">Primary Texts</Label>
                                <div className="space-y-2 mt-1.5">
                                  {ad.primaryTexts.map((t, i) => (
                                    <div key={i} className="flex gap-2 items-start">
                                      <Textarea value={t} onChange={e => updatePrimaryText(adSet.id, ad.id, i, e.target.value)} placeholder={`Primary text ${i + 1}`} rows={4} className="resize-y flex-1" />
                                      {ad.primaryTexts.length > 1 && (
                                        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 mt-0.5 text-destructive hover:text-destructive" onClick={() => removePrimaryText(adSet.id, ad.id, i)}>
                                          <X className="w-3.5 h-3.5" />
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <Button variant="link" size="sm" onClick={() => addPrimaryText(adSet.id, ad.id)} className="text-primary px-0 mt-1">
                                  + Add primary text
                                </Button>
                              </div>

                              <hr className="border-border" />

                              {/* Creative */}
                              <CreativeSection
                                data={ad.creative}
                                onChange={(creative) => updateAd(adSet.id, ad.id, { creative })}
                              />

                              {/* Per-ad URL override — image/video only (carousel uses per-card URLs) */}
                              {(ad.creative.type === 'SINGLE_IMAGE' || ad.creative.type === 'SINGLE_VIDEO') && (() => {
                                const templateUrl = adStore.items.find(t => t.id === ad.adTemplateId)?.conversionDomain;
                                return (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Destination URL (Optional)</Label>
                                    <Input
                                      value={ad.urlOverride}
                                      onChange={e => updateAd(adSet.id, ad.id, { urlOverride: e.target.value })}
                                      placeholder={templateUrl ? `Overrides template URL — ${templateUrl}` : 'https://example.com/landing'}
                                      className="mt-1"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      Leave blank to use the ad template's URL.
                                    </p>
                                  </div>
                                );
                              })()}

                              {/* Per-ad delivery schedule — optional on any creative type */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Schedule Start (Optional)</Label>
                                  <div className="mt-1">
                                    <DateTimePicker
                                      value={ad.scheduleStart}
                                      onChange={v => updateAd(adSet.id, ad.id, { scheduleStart: v })}
                                      placeholder="Pick start date & time"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Schedule End (Optional)</Label>
                                  <div className="mt-1">
                                    <DateTimePicker
                                      value={ad.scheduleEnd}
                                      onChange={v => updateAd(adSet.id, ad.id, { scheduleEnd: v })}
                                      placeholder="Pick end date & time"
                                    />
                                  </div>
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground -mt-2">
                                Leave blank to run for the full ad set window. Times use your local timezone.
                              </p>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Button variant="outline" size="sm" onClick={() => addAd(adSet.id)} className="border-primary/30 text-primary hover:bg-primary/10">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add New Ad
                  </Button>

                  </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={addAdSet} className="mt-4 border-primary/30 text-primary hover:bg-primary/10">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Another Ad Set
          </Button>
        </div>

        </div>

        {/* Right: sticky sidebar — Start Campaign + Readiness + Summary */}
        <div className="w-80 shrink-0 hidden lg:block self-start sticky top-[100px]">
          <div className="space-y-3 max-h-[calc(100vh-120px)] overflow-y-auto overflow-x-visible no-scrollbar p-1">

            {/* Start Campaign button — at the very top */}
            <Button
              onClick={handleStartCampaign}
              disabled={isLaunching || completedCount < totalCount}
              className="w-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold py-5 shadow-lg shadow-primary/20 hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all duration-200 rounded-xl text-sm"
            >
              {isLaunching ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Launching...</>
              ) : (
                <><Rocket className="w-4 h-4 mr-2" /> Start Campaign</>
              )}
            </Button>

            {/* Readiness checklist */}
            <Card className="animate-fade-in">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Readiness</span>
                  <Badge variant={completedCount === totalCount ? 'default' : 'secondary'} className="text-xs font-bold">
                    {completedCount}/{totalCount}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-1.5">
                {readinessItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {item.done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    )}
                    <span className={cn('text-[11px] leading-tight', item.done ? 'text-muted-foreground' : 'text-foreground font-medium')}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Campaign Summary — live overview */}
            <Card className="animate-fade-in border-primary/10">
              <CardHeader className="pb-2 pt-4 px-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Campaign Summary</span>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {/* Campaign info */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-muted-foreground uppercase">Campaign</span>
                  </div>
                  <p className="text-xs font-bold text-foreground truncate">
                    {campaignType === 'existing'
                      ? (existingCampaigns?.find(c => c.id === existingCampaignId)?.name || existingCampaignId || <span className="text-muted-foreground italic font-normal">No campaign selected</span>)
                      : (campaignName || <span className="text-muted-foreground italic font-normal">Untitled campaign</span>)}
                  </p>
                  {campaignTemplateId && (() => {
                    const tpl = campaignStore.items.find(t => t.id === campaignTemplateId);
                    return tpl ? (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{tpl.campaignObjective?.replace('OUTCOME_', '') || 'No objective'}</span>
                        <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{tpl.buyingType || 'AUCTION'}</span>
                        {tpl.campaignBudgetValue && (
                          <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{tpl.campaignBudgetType} €{tpl.campaignBudgetValue}</span>
                        )}
                      </div>
                    ) : null;
                  })()}
                </div>

                <div className="border-t border-border/30" />

                {/* Ad Sets summary */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-muted-foreground uppercase">Ad Sets</span>
                    <span className="text-[10px] font-bold text-primary">{adSets.length}</span>
                  </div>

                  {adSets.map((adSet, si) => {
                    const adsetTpl = adsetStore.items.find(t => t.id === adSet.adsetTemplateId);
                    return (
                      <div key={adSet.id} className="bg-background rounded-lg p-2.5 space-y-1.5">
                        <p className="text-[11px] font-bold text-foreground truncate">
                          {adSet.type === 'existing'
                            ? (existingAdSets?.find(a => a.id === adSet.existingAdsetId)?.name || adSet.existingAdsetId || `Ad Set ${si + 1}`)
                            : (adSet.name || `Ad Set ${si + 1}`)}
                        </p>
                        {adsetTpl && (
                          <div className="flex flex-wrap gap-1">
                            {adsetTpl.optimization && (
                              <span className="text-[9px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded">{adsetTpl.optimization}</span>
                            )}
                            {adsetTpl.targetAge && (
                              <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{adsetTpl.targetGender} {adsetTpl.targetAge}</span>
                            )}
                            {adsetTpl.placements && (
                              <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{adsetTpl.placements}</span>
                            )}
                          </div>
                        )}

                        {/* Ads within this ad set */}
                        <div className="space-y-1 mt-1">
                          {adSet.ads.map((ad, ai) => {
                            const adTpl = adStore.items.find(t => t.id === ad.adTemplateId);
                            return (
                              <div key={ad.id} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <div className="w-1 h-1 rounded-full bg-primary/50" />
                                <span className="truncate flex-1">{ad.name || `Ad ${ai + 1}`}</span>
                                <span className="text-[9px] bg-muted px-1 py-0.5 rounded shrink-0">
                                  {ad.creative.type === 'SINGLE_IMAGE' ? 'IMG' : ad.creative.type === 'SINGLE_VIDEO' ? 'VID' : 'CRL'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

      </div>

      {/* Launch Overlay */}
      {isLaunching && (
        <div className="fixed inset-0 z-50 bg-foreground/80 backdrop-blur-sm flex items-center justify-center animate-fade-in">
          <div className="bg-card rounded-2xl shadow-2xl p-10 max-w-lg w-full mx-4 text-center space-y-6 animate-scale-in">
            {/* Spinner */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            </div>

            {/* Quote */}
            <p className="text-lg font-medium text-foreground animate-fade-in" key={launchQuote}>
              {launchQuote}
            </p>

            {/* Campaign Summary */}
            <div className="bg-background rounded-xl p-5 text-left space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Launching Campaign</p>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Campaign</span>
                  <span className="font-bold truncate ml-4">
                    {campaignType === 'existing'
                      ? (existingCampaigns?.find(c => c.id === existingCampaignId)?.name || 'Existing Campaign')
                      : (campaignName || 'Untitled')}
                  </span>
                </div>
                {campaignTemplateId && (() => {
                  const tpl = campaignStore.items.find(t => t.id === campaignTemplateId);
                  return tpl ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Objective</span>
                      <span className="font-medium">{tpl.campaignObjective?.replace('OUTCOME_', '')}</span>
                    </div>
                  ) : null;
                })()}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ad Sets</span>
                  <span className="font-bold">{adSets.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Ads</span>
                  <span className="font-bold">{adSets.reduce((sum, s) => sum + s.ads.length, 0)}</span>
                </div>
              </div>

              {/* Ad sets breakdown */}
              <div className="border-t border-border/30 pt-2 space-y-1.5">
                {adSets.map((adSet, i) => (
                  <div key={adSet.id} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate">
                      {adSet.type === 'existing'
                        ? (existingAdSets?.find(a => a.id === adSet.existingAdsetId)?.name || `Ad Set ${i + 1}`)
                        : (adSet.name || `Ad Set ${i + 1}`)}
                    </span>
                    <span className="shrink-0 ml-2">{adSet.ads.length} ad{adSet.ads.length !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">Please don't close this window</p>
          </div>
        </div>
      )}

      {/* Template create/edit slide-over */}
      <Sheet open={templateSheet !== null} onOpenChange={(open) => { if (!open) setTemplateSheet(null); }}>
        <SheetContent side="right" className="!w-[50vw] !max-w-[50vw] overflow-y-auto p-0 flex flex-col">
          <SheetHeader className="p-6 pb-4 border-b border-border/30">
            <SheetTitle className="text-xl font-bold tracking-tight">
              {templateSheet?.isNew ? 'New' : 'Edit'} {
                templateSheet?.type === 'campaign' ? 'Campaign' :
                templateSheet?.type === 'adset' ? 'Ad Set' :
                templateSheet?.type === 'ad' ? 'Ad' :
                templateSheet?.type === 'advantage' ? 'Advantage+ Creative' : ''
              } Template
            </SheetTitle>
            <SheetDescription className="text-[10px] font-bold text-primary tracking-widest uppercase">
              {templateSheet?.isNew ? 'Create a new template' : `ID: ${templateSheet?.template?.id?.substring(0, 8).toUpperCase()}`}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-6">
            {templateSheet?.type === 'campaign' && (
              <CampaignTemplateForm
                template={templateSheet.template}
                onSave={(t) => handleTemplateSave(t)}
                onCancel={() => setTemplateSheet(null)}
              />
            )}
            {templateSheet?.type === 'adset' && (
              <AdsetTemplateForm
                template={templateSheet.template}
                onSave={(t) => handleTemplateSave(t)}
                onCancel={() => setTemplateSheet(null)}
                accountId={accountId || undefined}
              />
            )}
            {templateSheet?.type === 'ad' && (
              <AdTemplateForm
                template={templateSheet.template}
                onSave={(t) => handleTemplateSave(t)}
                onCancel={() => setTemplateSheet(null)}
              />
            )}
            {templateSheet?.type === 'advantage' && (
              <AdvantageCreativeForm
                template={templateSheet.template}
                onSave={(t) => handleTemplateSave(t)}
                onCancel={() => setTemplateSheet(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* AI Template Recommender floating bubble */}
      <AITemplateRecommender
        onApplyCampaign={(id) => setCampaignTemplateId(id)}
        onApplyAdset={(id) => {
          // Apply to the first ad set (user can change manually)
          if (adSets.length > 0) updateAdSet(adSets[0].id, { adsetTemplateId: id });
        }}
        onApplyAd={(id) => {
          // Apply to the first ad in the first ad set
          if (adSets.length > 0 && adSets[0].ads.length > 0) {
            updateAd(adSets[0].id, adSets[0].ads[0].id, { adTemplateId: id });
          }
        }}
      />
    </AppLayout>
  );
}
