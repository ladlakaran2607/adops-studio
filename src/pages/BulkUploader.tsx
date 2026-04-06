import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AccountSelector } from '@/components/shared/AccountSelector';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Rocket, Copy, X, Search, RefreshCw, Image, Film, LayoutGrid, Check, Info, ClipboardList,
} from 'lucide-react';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { metaPost, metaGet } from '@/lib/metaApi';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AdSet {
  id: string;
  name: string;
  campaignName: string;
}

interface ExistingAd {
  id: string;
  name: string;
  headline: string;
  body: string;
  campaignName: string;
  adType: 'IMAGE' | 'VIDEO' | 'CAROUSEL';
}

interface MetaFetchAdsResponse {
  ads: Array<{
    id: string;
    name: string;
    ad_type: string;
    campaign_id?: string;
    campaign_name?: string;
    headlines: string[];
    bodies: string[];
  }>;
}

interface MetaFetchAdsetsResponse {
  ad_sets: Array<{
    id: string;
    name: string;
    campaign_name: string;
  }>;
}

interface BulkDuplicateResponse {
  results: Array<{
    source_ad_id: string;
    target_adset_id: string;
    status: string;
    new_ad_id?: string;
    error?: string;
  }>;
  summary: { total: number; success: number; errors: number };
}

const adTypeBadge = (type: string) => {
  const icon = type === 'VIDEO' ? <Film className="w-3 h-3" /> : type === 'CAROUSEL' ? <LayoutGrid className="w-3 h-3" /> : <Image className="w-3 h-3" />;
  return (
    <span className="px-2 py-0.5 text-[9px] font-bold tracking-wider rounded-full bg-muted text-muted-foreground flex items-center gap-1">
      {icon} {type}
    </span>
  );
};

export default function BulkUploader() {
  const [accountId, setAccountId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [existingAds, setExistingAds] = useState<ExistingAd[]>([]);

  const [adSetSearch, setAdSetSearch] = useState('');
  const [selectedAdSetIds, setSelectedAdSetIds] = useState<Set<string>>(new Set());

  const filteredAdSets = adSets.filter(as =>
    as.name.toLowerCase().includes(adSetSearch.toLowerCase()) ||
    as.campaignName.toLowerCase().includes(adSetSearch.toLowerCase())
  );

  const toggleAdSet = (id: string) => {
    setSelectedAdSetIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const [existingAdSearch, setExistingAdSearch] = useState('');
  const [selectedAdIds, setSelectedAdIds] = useState<Set<string>>(new Set());

  const filteredExistingAds = existingAds.filter(ad => {
    const q = existingAdSearch.toLowerCase();
    if (!q) return true;
    return ad.name.toLowerCase().includes(q) ||
      ad.id.toLowerCase().includes(q) ||
      ad.headline.toLowerCase().includes(q) ||
      ad.campaignName.toLowerCase().includes(q);
  });

  const toggleAd = (id: string) => {
    setSelectedAdIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);

  const handleRefresh = async () => {
    if (!accountId) return;
    setIsLoading(true);
    try {
      const [adsData, adsetsData] = await Promise.all([
        invokeEdgeFunction<MetaFetchAdsResponse>('meta-fetch-ads', { account_id: accountId }),
        invokeEdgeFunction<MetaFetchAdsetsResponse>('meta-fetch-adsets', { account_id: accountId }),
      ]);
      const mappedAds: ExistingAd[] = (adsData.ads || []).map(a => ({
        id: a.id,
        name: a.name,
        headline: a.headlines?.[0] || '',
        body: a.bodies?.[0] || '',
        campaignName: a.campaign_name || '',
        adType: (a.ad_type || 'IMAGE') as ExistingAd['adType'],
      }));
      const mappedAdSets: AdSet[] = (adsetsData.ad_sets || []).map(as => ({
        id: as.id,
        name: as.name,
        campaignName: as.campaign_name || '',
      }));
      setExistingAds(mappedAds);
      setAdSets(mappedAdSets);
      setSelectedAdIds(new Set());
      setSelectedAdSetIds(new Set());
      toast.success(`Loaded ${mappedAds.length} ads and ${mappedAdSets.length} ad sets`);
    } catch (err) {
      toast.error(`Failed to load data: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunch = async () => {
    setLaunching(true);
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      const adIds = [...selectedAdIds];
      const adSetIds = [...selectedAdSetIds];

      // Step 1: Fetch full ad + creative spec for all selected ads (once per ad)
      const adCreatives: Record<string, { name: string; creative: Record<string, unknown>; trackingSpecs?: unknown; urlTags?: string }> = {};

      // Creative fields: only request fields that exist on the AdCreative object in Meta API
      const creativeFields = [
        'id',
        'name',
        'asset_feed_spec',
        'object_story_spec',
        'degrees_of_freedom_spec',
        'product_set_id',
        'instagram_user_id',
        'instagram_actor_id',
      ].join(',');

      for (const adId of adIds) {
        try {
          const adData = await metaGet(accountId, `${adId}?fields=name,tracking_specs,creative{${creativeFields}}`);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const creative = (adData as any)?.creative;
          if (!creative) throw new Error('No creative found');

          // Determine ad type from creative structure
          const hasAssetFeed = !!creative.asset_feed_spec;
          const hasOSS = !!creative.object_story_spec;
          const oss = creative.object_story_spec || {};
          const isVideo = !!oss.video_data || creative.asset_feed_spec?.ad_formats?.includes('SINGLE_VIDEO');
          const isCarousel = !!oss.link_data?.child_attachments || creative.asset_feed_spec?.ad_formats?.includes('CAROUSEL');
          const adType = isVideo ? 'VIDEO' : isCarousel ? 'CAROUSEL' : 'IMAGE';
          const structureType = hasAssetFeed ? 'ASSET_FEED' : 'SIMPLE';
          console.log(`[Bulk Duplicate] Ad ${adId}: ${adType} ${structureType}`);

          // Build clean creative spec
          const cleanCreative: Record<string, unknown> = {};

          // === ASSET FEED SPEC ===
          if (hasAssetFeed) {
            // Deep clone and strip Meta-generated IDs from adlabels (they're read-only)
            const afs = JSON.parse(JSON.stringify(creative.asset_feed_spec));
            const stripAdLabels = (items: Record<string, unknown>[] | undefined) => {
              if (!Array.isArray(items)) return items;
              return items.map(item => {
                if (Array.isArray(item.adlabels)) {
                  item.adlabels = (item.adlabels as Record<string, unknown>[]).map(l => ({ name: l.name }));
                }
                return item;
              });
            };
            if (afs.titles) afs.titles = stripAdLabels(afs.titles);
            if (afs.bodies) afs.bodies = stripAdLabels(afs.bodies);
            if (afs.descriptions) afs.descriptions = stripAdLabels(afs.descriptions);
            if (afs.images) {
              afs.images = (afs.images as Record<string, unknown>[]).map(img => {
                const cleaned: Record<string, unknown> = {};
                // Prefer url; if only hash present, keep hash
                if (img.url) cleaned.url = img.url;
                else if (img.hash) cleaned.hash = img.hash;
                if (img.adlabels) cleaned.adlabels = (img.adlabels as Record<string, unknown>[]).map(l => ({ name: l.name }));
                if (img.image_crops) cleaned.image_crops = img.image_crops;
                return cleaned;
              });
            }
            if (afs.videos) {
              afs.videos = (afs.videos as Record<string, unknown>[]).map(vid => {
                const cleaned: Record<string, unknown> = {};
                if (vid.video_id) cleaned.video_id = vid.video_id;
                if (vid.thumbnail_url) cleaned.thumbnail_url = vid.thumbnail_url;
                if (vid.thumbnail_hash) cleaned.thumbnail_hash = vid.thumbnail_hash;
                if (vid.adlabels) cleaned.adlabels = (vid.adlabels as Record<string, unknown>[]).map(l => ({ name: l.name }));
                return cleaned;
              });
            }
            if (afs.asset_customization_rules) {
              afs.asset_customization_rules = (afs.asset_customization_rules as Record<string, unknown>[]).map(rule => {
                const cleanedRule: Record<string, unknown> = { ...rule };
                // Strip IDs from label refs
                for (const key of ['image_label', 'video_label', 'title_label', 'body_label', 'description_label', 'carousel_label']) {
                  if (cleanedRule[key] && typeof cleanedRule[key] === 'object') {
                    cleanedRule[key] = { name: (cleanedRule[key] as Record<string, unknown>).name };
                  }
                }
                return cleanedRule;
              });
            }
            // Strip read-only fields
            delete afs.additional_data;
            delete afs.reasons_to_shop;
            delete afs.shops_bundle;

            cleanCreative.asset_feed_spec = afs;

            // object_story_spec for asset feed ads usually contains only page_id + instagram_user_id
            if (hasOSS) {
              const minimalOss: Record<string, unknown> = {};
              if (oss.page_id) minimalOss.page_id = oss.page_id;
              if (oss.instagram_user_id) minimalOss.instagram_user_id = oss.instagram_user_id;
              if (oss.instagram_actor_id) minimalOss.instagram_actor_id = oss.instagram_actor_id;
              cleanCreative.object_story_spec = minimalOss;
            }
          }

          // === SIMPLE SPEC (object_story_spec only) ===
          else if (hasOSS) {
            const cleanOss: Record<string, unknown> = {};
            if (oss.page_id) cleanOss.page_id = oss.page_id;
            if (oss.instagram_user_id) cleanOss.instagram_user_id = oss.instagram_user_id;
            if (oss.instagram_actor_id) cleanOss.instagram_actor_id = oss.instagram_actor_id;

            // VIDEO
            if (oss.video_data) {
              const vd = oss.video_data;
              const cleanVd: Record<string, unknown> = {};
              if (vd.video_id) cleanVd.video_id = vd.video_id;
              if (vd.image_url) cleanVd.image_url = vd.image_url;
              else if (vd.image_hash) cleanVd.image_hash = vd.image_hash;
              if (vd.title) cleanVd.title = vd.title;
              if (vd.message) cleanVd.message = vd.message;
              if (vd.link_description) cleanVd.link_description = vd.link_description;
              if (vd.call_to_action) cleanVd.call_to_action = vd.call_to_action;
              cleanOss.video_data = cleanVd;
            }
            // IMAGE / CAROUSEL (link_data)
            else if (oss.link_data) {
              const ld = oss.link_data;
              const cleanLd: Record<string, unknown> = {};
              if (ld.link) cleanLd.link = ld.link;
              if (ld.message) cleanLd.message = ld.message;
              if (ld.name) cleanLd.name = ld.name;
              if (ld.description) cleanLd.description = ld.description;
              // Prefer picture over image_hash (Meta rejects both)
              if (ld.picture) cleanLd.picture = ld.picture;
              else if (ld.image_hash) cleanLd.image_hash = ld.image_hash;
              if (ld.call_to_action) cleanLd.call_to_action = ld.call_to_action;
              if (ld.multi_share_optimized !== undefined) cleanLd.multi_share_optimized = ld.multi_share_optimized;
              if (ld.multi_share_end_card !== undefined) cleanLd.multi_share_end_card = ld.multi_share_end_card;

              // Carousel child attachments
              if (Array.isArray(ld.child_attachments)) {
                cleanLd.child_attachments = (ld.child_attachments as Record<string, unknown>[]).map(c => {
                  const cleanChild: Record<string, unknown> = {};
                  if (c.name) cleanChild.name = c.name;
                  if (c.link) cleanChild.link = c.link;
                  if (c.description) cleanChild.description = c.description;
                  // Prefer picture over image_hash
                  if (c.picture) cleanChild.picture = c.picture;
                  else if (c.image_hash) cleanChild.image_hash = c.image_hash;
                  if (c.video_id) cleanChild.video_id = c.video_id;
                  if (c.call_to_action) cleanChild.call_to_action = c.call_to_action;
                  return cleanChild;
                });
              }
              cleanOss.link_data = cleanLd;
            }

            cleanCreative.object_story_spec = cleanOss;
          }

          // === Advantage+ Creative (degrees_of_freedom_spec) ===
          if (creative.degrees_of_freedom_spec) {
            // Strip empty/internal fields
            const dofs = creative.degrees_of_freedom_spec;
            if (dofs.creative_features_spec && Object.keys(dofs.creative_features_spec).length > 0) {
              cleanCreative.degrees_of_freedom_spec = { creative_features_spec: dofs.creative_features_spec };
            }
          }

          // === Catalog / Instagram IDs ===
          if (creative.product_set_id) cleanCreative.product_set_id = creative.product_set_id;
          if (creative.instagram_user_id && !(cleanCreative.object_story_spec as Record<string, unknown>)?.instagram_user_id) {
            cleanCreative.instagram_user_id = creative.instagram_user_id;
          }

          adCreatives[adId] = {
            name: (adData as any)?.name || 'Duplicated Ad',
            creative: cleanCreative,
            trackingSpecs: (adData as any)?.tracking_specs,
          };
        } catch (err) {
          // If we can't fetch this ad's creative, skip all its duplications
          for (const _ of adSetIds) {
            errorCount++;
            errors.push(`Ad ${adId} → fetch failed: ${(err as Error).message}`);
          }
          console.error(`[Bulk Duplicate] Failed to fetch ad ${adId}:`, err);
        }
      }

      // Step 2: For each (ad, adset) combo, create a new ad with the fetched creative
      for (const adId of adIds) {
        const adInfo = adCreatives[adId];
        if (!adInfo) continue; // Skip if fetch failed

        for (const adsetId of adSetIds) {
          try {
            const adParams: Record<string, unknown> = {
              name: `${adInfo.name} (copy)`,
              adset_id: adsetId,
              status: 'PAUSED',
              creative: adInfo.creative,
            };
            if (adInfo.urlTags) adParams.url_tags = adInfo.urlTags;
            if (adInfo.trackingSpecs) adParams.tracking_specs = adInfo.trackingSpecs;

            await metaPost(accountId, `act_${accountId}/ads`, adParams);
            successCount++;
          } catch (err) {
            errorCount++;
            errors.push(`Ad ${adId} → Ad Set ${adsetId}: ${(err as Error).message}`);
            console.error(`[Bulk Duplicate] Failed:`, adId, '→', adsetId, err);
          }
        }
      }

      setLaunched(true);
      const total = successCount + errorCount;
      if (errorCount > 0 && successCount > 0) {
        toast.warning(`${successCount}/${total} duplications successful, ${errorCount} failed`);
      } else if (errorCount > 0) {
        toast.error(`${errorCount}/${total} duplications failed`);
      } else {
        toast.success(`All ${total} duplications successful!`);
      }
      if (errors.length > 0) console.error('[Bulk Duplicate Errors]', errors);
      setSelectedAdIds(new Set());
      setSelectedAdSetIds(new Set());
      setTimeout(() => setLaunched(false), 5000);
    } catch (err) {
      toast.error(`Duplication failed: ${(err as Error).message}`);
    } finally {
      setLaunching(false);
    }
  };

  const canLaunch = selectedAdIds.size > 0 && selectedAdSetIds.size > 0;
  const totalNewAds = selectedAdIds.size * selectedAdSetIds.size;

  return (
    <AppLayout>
      {/* Sticky Header — account selector + Load button in header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/30 px-8 py-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bulk Uploader</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Duplicate existing ads across multiple ad sets</p>
          </div>
          <div className="flex items-end gap-4">
            <div className="w-72">
              <AccountSelector value={accountId} onChange={setAccountId} />
            </div>
            <Button
              onClick={handleRefresh}
              disabled={!accountId || isLoading}
              className="bg-primary text-primary-foreground font-bold px-6 h-10 rounded-xl shadow-sm hover:opacity-90 active:scale-95 transition-all"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Load Ads & Ad Sets
            </Button>
          </div>
        </div>
      </header>

      <div className="px-8 pb-12">
        {/* Guidance banner — shown until data is loaded */}
        {existingAds.length === 0 && !isLoading && (
          <div className="my-6 p-4 bg-accent rounded-xl flex items-center gap-4 animate-fade-in">
            <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center text-primary shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {!accountId
                ? <>Select your ad account above, then click <strong>'Load Ads & Ad Sets'</strong> to get started.</>
                : <>Click <strong>'Load Ads & Ad Sets'</strong> to fetch your campaigns.</>
              }
            </p>
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-10 gap-8 items-start mt-6">

          {/* Left Column: Ads List (60%) */}
          <section className="col-span-6">
            <Card className="shadow-sm animate-fade-in overflow-hidden">
              <div className="p-6 border-b border-border/30">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-lg font-bold tracking-tight">Select Ads to Duplicate</h3>
                  <span className="text-xs font-mono text-primary bg-primary/5 px-2.5 py-1 rounded-lg font-bold">
                    {selectedAdIds.size} SELECTED
                  </span>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={existingAdSearch}
                    onChange={e => setExistingAdSearch(e.target.value)}
                    placeholder="Search by ad name, ID, headline or campaign..."
                    className="pl-10 bg-transparent border-0 border-b border-border rounded-none focus-visible:ring-0 focus-visible:border-primary transition-colors"
                  />
                </div>
              </div>

              <div className="overflow-y-auto max-h-[600px] divide-y divide-border/30">
                {filteredExistingAds.map(ad => {
                  const selected = selectedAdIds.has(ad.id);
                  return (
                    <div
                      key={ad.id}
                      onClick={() => toggleAd(ad.id)}
                      className={cn(
                        "p-4 flex items-center gap-4 cursor-pointer transition-colors",
                        selected ? 'bg-primary/5' : 'hover:bg-muted/30'
                      )}
                    >
                      <Checkbox checked={selected} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm truncate">{ad.name}</span>
                          {adTypeBadge(ad.adType)}
                        </div>
                        {ad.headline && (
                          <p className="text-xs text-muted-foreground truncate">Headline: {ad.headline}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5 uppercase truncate">
                          {ad.campaignName ? `Campaign: ${ad.campaignName}` : `ID: ${ad.id}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {filteredExistingAds.length === 0 && (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    {existingAds.length === 0 ? 'No ads loaded yet' : 'No ads match your search'}
                  </div>
                )}
              </div>
            </Card>
          </section>

          {/* Right Column: Target Ad Sets (40%) + Execution Plan */}
          <section className="col-span-4 space-y-6">
            {/* Target Ad Sets */}
            <Card className="shadow-sm animate-fade-in overflow-hidden">
              <div className="p-6 border-b border-border/30">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-lg font-bold tracking-tight">Target Ad Sets</h3>
                  <span className="text-xs font-mono text-primary bg-primary/5 px-2.5 py-1 rounded-lg font-bold">
                    {selectedAdSetIds.size} SELECTED
                  </span>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={adSetSearch}
                    onChange={e => setAdSetSearch(e.target.value)}
                    placeholder="Search by ad set or campaign name..."
                    className="pl-10 bg-transparent border-0 border-b border-border rounded-none focus-visible:ring-0 focus-visible:border-primary transition-colors"
                  />
                </div>
              </div>

              <div className="overflow-y-auto max-h-[400px] divide-y divide-border/30">
                {filteredAdSets.map(as => {
                  const selected = selectedAdSetIds.has(as.id);
                  return (
                    <div
                      key={as.id}
                      onClick={() => toggleAdSet(as.id)}
                      className={cn(
                        "p-4 flex items-center gap-4 cursor-pointer transition-colors",
                        selected ? 'bg-primary/5' : 'hover:bg-muted/30'
                      )}
                    >
                      <Checkbox checked={selected} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-foreground truncate">{as.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5 uppercase truncate">
                          Campaign: {as.campaignName}
                        </div>
                      </div>
                      {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </div>
                  );
                })}
                {filteredAdSets.length === 0 && (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    {adSets.length === 0 ? 'No ad sets loaded yet' : 'No ad sets match your search'}
                  </div>
                )}
              </div>
            </Card>

            {/* Execution Plan */}
            <Card className="shadow-sm animate-fade-in border-primary/10">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold tracking-tight">Execution Plan</h3>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Selected Ads</span>
                    <span className="font-bold">{selectedAdIds.size}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Target Ad Sets</span>
                    <span className="font-bold">{selectedAdSetIds.size}</span>
                  </div>
                  <div className="border-t border-border/30 pt-2 flex justify-between text-sm">
                    <span className="font-bold text-primary">New Entities</span>
                    <span className="font-bold text-primary">{totalNewAds} total ads</span>
                  </div>
                </div>

                {canLaunch && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {selectedAdIds.size} ads × {selectedAdSetIds.size} ad sets = {totalNewAds} total ads to create. All creative settings and tracking parameters will be preserved.
                  </p>
                )}

                <Button
                  onClick={handleLaunch}
                  disabled={!canLaunch || launching}
                  className="w-full bg-foreground text-background hover:bg-foreground/90 font-bold py-5 rounded-xl text-sm transition-all active:scale-95"
                >
                  {launching ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Duplicating...</>
                  ) : (
                    <>Duplicate {selectedAdIds.size} Ads to {selectedAdSetIds.size} Ad Sets <Rocket className="w-4 h-4 ml-2" /></>
                  )}
                </Button>
              </CardContent>
            </Card>
          </section>

        </div>
      </div>
    </AppLayout>
  );
}
