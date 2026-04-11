import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AccountSelector } from '@/components/shared/AccountSelector';
import { useAdAccounts, getMissingAccountFields } from '@/hooks/useAdAccounts';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Rocket, Copy, X, Search, RefreshCw, Image, Film, LayoutGrid, Check, Info, ClipboardList, AlertTriangle,
} from 'lucide-react';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { metaPost, metaGet } from '@/lib/metaApi';
import { buildCreativeUpdate } from '@/lib/metaCreativeUpdate';
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

  const { data: adAccounts } = useAdAccounts();
  const selectedAccount = adAccounts?.find(a => a.accountId === accountId);
  const missingAccountFields = getMissingAccountFields(selectedAccount);
  const isAccountIncomplete = !!selectedAccount && missingAccountFields.length > 0;

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

      // Step 1: Fetch each source ad + its creative once, then build the
      // adcreatives payload using the same builders AdsProcessing uses. We
      // pass empty headlines/bodies/descriptions so `buildCreativeUpdate`
      // short-circuits the text-replacement branches and clones the creative
      // verbatim — same structural handling (OSS preserved, DOF sanitized,
      // dangling-label validation, image_url/image_hash conflict resolution)
      // that fixed AdsProcessing's Push to Meta flow.
      const adCreatives: Record<string, { name: string; payload: Record<string, unknown>; trackingSpecs?: unknown }> = {};

      for (const adId of adIds) {
        try {
          const adData = await metaGet(
            accountId,
            `${adId}?fields=name,tracking_specs,creative{id,name,asset_feed_spec,object_story_spec,degrees_of_freedom_spec,url_tags}`
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const creative = (adData as any)?.creative;
          if (!creative) throw new Error('No creative found');

          // Empty text arrays → builders leave all text verbatim.
          const emptyAd = { id: adId, name: '', headlines: [], bodies: [], descriptions: [] };
          const { payload, family, format } = buildCreativeUpdate(emptyAd, creative);
          console.log(`[Bulk Duplicate] Ad ${adId} — ${family}/${format}`);

          adCreatives[adId] = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            name: (adData as any)?.name || 'Duplicated Ad',
            payload,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            trackingSpecs: (adData as any)?.tracking_specs,
          };
        } catch (err) {
          // If we can't fetch or build this ad's creative, skip all its
          // duplications and record an error for each intended target.
          for (const _ of adSetIds) {
            errorCount++;
            errors.push(`Ad ${adId} → build failed: ${(err as Error).message}`);
          }
          console.error(`[Bulk Duplicate] Failed to prepare ad ${adId}:`, err);
        }
      }

      // Step 2: For each (sourceAd × targetAdSet) combo, mint a new creative
      // via /adcreatives and then create a new ad pointing at it. Minting
      // per combo (not per source ad) keeps each destination ad's creative
      // independent — closer to how Meta's own "duplicate" button works and
      // avoids a shared-creative reference across ad sets.
      for (const adId of adIds) {
        const adInfo = adCreatives[adId];
        if (!adInfo) continue; // Skipped during build

        for (const adsetId of adSetIds) {
          try {
            const createRes = await metaPost(accountId, `act_${accountId}/adcreatives`, adInfo.payload);
            const newCreativeId = (createRes as { id?: string }).id;
            if (!newCreativeId) throw new Error('Meta did not return a creative id');

            const adParams: Record<string, unknown> = {
              name: `${adInfo.name} (copy)`,
              adset_id: adsetId,
              status: 'PAUSED',
              creative: { creative_id: newCreativeId },
            };
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
      // Surface the first Meta error verbatim so users see the actual cause
      // (permissions, invalid field, etc.) instead of just a count. The full
      // list of errors still goes to the console for debugging.
      const firstErrorRaw = errors[0] || '';
      const firstErrorMsg = firstErrorRaw.includes(':')
        ? firstErrorRaw.slice(firstErrorRaw.indexOf(':') + 1).trim()
        : firstErrorRaw;
      const shortError = firstErrorMsg.length > 180
        ? firstErrorMsg.slice(0, 180) + '…'
        : firstErrorMsg;

      if (errorCount > 0 && successCount > 0) {
        toast.warning(
          `${successCount}/${total} duplications successful, ${errorCount} failed. First error: ${shortError}`,
          { duration: 12000 }
        );
      } else if (errorCount > 0) {
        toast.error(
          `${errorCount}/${total} duplications failed. ${shortError}`,
          { duration: 12000 }
        );
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

        {isAccountIncomplete && (
          <div className="mt-6 rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Account setup incomplete</p>
                <p className="text-xs text-amber-900/80 dark:text-amber-200/80 mt-1 leading-relaxed">
                  <span className="font-semibold">{selectedAccount?.name}</span> is missing <span className="font-mono">{missingAccountFields.join(', ')}</span>. Duplicated ads inherit the source ad's page and pixel, so this page will still work — but new campaigns cannot be launched from the Campaign Builder until these fields are configured in the main app.
                </p>
              </div>
            </div>
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
