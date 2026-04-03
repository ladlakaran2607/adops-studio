import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AccountSelector } from '@/components/shared/AccountSelector';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Rocket, Copy, X, Search, RefreshCw, Image, Film, LayoutGrid, Check, ChevronRight,
} from 'lucide-react';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { toast } from 'sonner';

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
  adSetName: string;
  adType: 'IMAGE' | 'VIDEO' | 'CAROUSEL';
}

interface MetaFetchAdsResponse {
  ads: Array<{
    id: string;
    name: string;
    ad_type: string;
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

const adTypeIcon = (type: string) => {
  if (type === 'VIDEO') return <Film className="w-3 h-3" />;
  if (type === 'CAROUSEL') return <LayoutGrid className="w-3 h-3" />;
  return <Image className="w-3 h-3" />;
};

export default function BulkUploader() {
  const [accountId, setAccountId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /* ── Data loaded from Meta ── */
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [existingAds, setExistingAds] = useState<ExistingAd[]>([]);

  /* ── Target ad sets ── */
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

  /* ── Existing ads selection ── */
  const [existingAdSearch, setExistingAdSearch] = useState('');
  const [selectedAdIds, setSelectedAdIds] = useState<Set<string>>(new Set());

  const filteredExistingAds = existingAds.filter(ad =>
    ad.name.toLowerCase().includes(existingAdSearch.toLowerCase()) ||
    ad.headline.toLowerCase().includes(existingAdSearch.toLowerCase()) ||
    ad.body.toLowerCase().includes(existingAdSearch.toLowerCase())
  );

  const toggleAd = (id: string) => {
    setSelectedAdIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  /* ── Launch state ── */
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
        adSetName: '',
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
    try {
      const data = await invokeEdgeFunction<BulkDuplicateResponse>('meta-bulk-duplicate', {
        account_id: accountId,
        source_ad_ids: [...selectedAdIds],
        target_adset_ids: [...selectedAdSetIds],
      });
      const { summary } = data;
      setLaunched(true);
      if (summary.errors > 0) {
        toast.warning(`${summary.success}/${summary.total} duplications successful, ${summary.errors} failed`);
      } else {
        toast.success(`All ${summary.total} duplications successful!`);
      }
      setTimeout(() => setLaunched(false), 5000);
    } catch (err) {
      toast.error(`Duplication failed: ${(err as Error).message}`);
    } finally {
      setLaunching(false);
    }
  };

  const canLaunch = selectedAdIds.size > 0 && selectedAdSetIds.size > 0;

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground font-display">Bulk Uploader</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Duplicate existing ads to multiple ad sets at once.
            </p>
          </div>
          {launched && (
            <Badge className="bg-success/15 text-success border-success/30 text-sm px-3 py-1.5">
              <Check className="w-4 h-4 mr-1.5" /> Ads successfully launched!
            </Badge>
          )}
        </div>

        {/* Account ID */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3 items-end">
              <AccountSelector value={accountId} onChange={setAccountId} className="flex-1" />
              <Button variant="outline" onClick={handleRefresh} disabled={!accountId || isLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          {/* Left: Select ads to duplicate */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Copy className="w-4 h-4 text-primary" />
                  Select ads to duplicate
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={existingAdSearch}
                    onChange={e => setExistingAdSearch(e.target.value)}
                    placeholder="Search by name, headline or body..."
                    className="pl-9 text-sm"
                  />
                </div>

                <div className="space-y-1 max-h-[460px] overflow-y-auto">
                  {filteredExistingAds.map(ad => {
                    const selected = selectedAdIds.has(ad.id);
                    return (
                      <div
                        key={ad.id}
                        onClick={() => toggleAd(ad.id)}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          selected ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50 border border-transparent'
                        }`}
                      >
                        <Checkbox checked={selected} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground truncate">{ad.name}</span>
                            <Badge variant="secondary" className="text-[10px] gap-1 shrink-0">
                              {adTypeIcon(ad.adType)} {ad.adType}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">{ad.headline}</div>
                          <div className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{ad.adSetName}</div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredExistingAds.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No ads found</p>
                  )}
                </div>

                {selectedAdIds.size > 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Badge className="bg-accent text-accent-foreground text-xs">
                      {selectedAdIds.size} ad{selectedAdIds.size !== 1 ? 's' : ''} selected
                    </Badge>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setSelectedAdIds(new Set())}>
                      Deselect all
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={handleLaunch}
              disabled={!canLaunch || launching}
              className="w-full"
              size="lg"
            >
              {launching ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Duplicating...</>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate {selectedAdIds.size} ad{selectedAdIds.size !== 1 ? 's' : ''} to {selectedAdSetIds.size} ad set{selectedAdSetIds.size !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>

          {/* Right: Target Ad Sets */}
          <div className="space-y-4">
            <Card className="sticky top-8">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Target Ad Sets</span>
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                    {selectedAdSetIds.size} selected
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={adSetSearch}
                    onChange={e => setAdSetSearch(e.target.value)}
                    placeholder="Search ad sets..."
                    className="pl-9 text-sm"
                  />
                </div>

                <div className="space-y-1 max-h-[500px] overflow-y-auto">
                  {filteredAdSets.map(as => {
                    const selected = selectedAdSetIds.has(as.id);
                    return (
                      <div
                        key={as.id}
                        onClick={() => toggleAdSet(as.id)}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                          selected ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50 border border-transparent'
                        }`}
                      >
                        <Checkbox checked={selected} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{as.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{as.campaignName}</div>
                        </div>
                        {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </div>
                    );
                  })}
                  {filteredAdSets.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No ad sets found</p>
                  )}
                </div>

                {selectedAdSetIds.size > 0 && (
                  <div className="pt-2 border-t border-border">
                    <Button variant="ghost" size="sm" className="text-xs h-7 w-full" onClick={() => setSelectedAdSetIds(new Set())}>
                      <X className="w-3 h-3 mr-1" /> Deselect all
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary */}
            {canLaunch && (
              <Card className="border-primary/20 bg-accent/20">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                    <Rocket className="w-4 h-4 text-primary" />
                    Launch Summary
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-3 h-3 text-primary" />
                      <span>{selectedAdIds.size} ad{selectedAdIds.size !== 1 ? 's' : ''} to duplicate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-3 h-3 text-primary" />
                      <span>{selectedAdSetIds.size} target ad set{selectedAdSetIds.size !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-3 h-3 text-primary" />
                      <span className="font-medium text-foreground">
                        = {selectedAdIds.size * selectedAdSetIds.size} ads total
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
