import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AccountSelector } from '@/components/shared/AccountSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Trash2, ChevronUp, ChevronDown, Copy, Loader2 } from 'lucide-react';
import { useTemplateStore } from '@/store/templateStore';
import type { CampaignTemplate, AdsetTemplate, AdTemplate, AdvantageCreativeTemplate } from '@/types/templates';
import { cn } from '@/lib/utils';
import { CreativeSection, createEmptyCreativeData, type CreativeData } from '@/components/builder/CreativeSection';
import { DocumentImport, type ParsedDocument } from '@/components/builder/DocumentImport';
import { launchCampaign, type LaunchResult } from '@/lib/campaignService';
import { useAuth } from '@/contexts/AuthContext';
import { useAdAccounts } from '@/hooks/useAdAccounts';
import { useLeadForms } from '@/hooks/useLeadForms';
import { toast } from 'sonner';

interface AdEntry {
  id: string;
  name: string;
  productSetId: string;
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
}

function createAd(index: number): AdEntry {
  return {
    id: crypto.randomUUID(),
    name: `Ad ${index}`,
    productSetId: '',
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
  };
}

export default function CampaignBuilder() {
  const [accountId, setAccountId] = useState('');
  const [campaignType, setCampaignType] = useState<'new' | 'existing'>('new');
  const [campaignName, setCampaignName] = useState('');
  const [existingCampaignId, setExistingCampaignId] = useState('');
  const [campaignTemplateId, setCampaignTemplateId] = useState('');
  const [adSets, setAdSets] = useState<AdSetEntry[]>([createAdSet(1)]);
  const [isLaunching, setIsLaunching] = useState(false);

  const { organizationId } = useAuth();
  const { data: adAccounts } = useAdAccounts();
  const selectedAccount = adAccounts?.find(a => a.accountId === accountId);
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
      ads: camp.ads.map((ad) => ({
        id: crypto.randomUUID(),
        name: ad.name,
        productSetId: '',
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

  const handleStartCampaign = async () => {
    // Validation
    if (!accountId) { toast.error('Please select an ad account'); return; }
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
      } else {
        // Multiple headlines/texts require dynamic creative
        for (const ad of adSet.ads) {
          const multiHeadlines = ad.headlines.filter(h => h.trim()).length > 1;
          const multiTexts = ad.primaryTexts.filter(t => t.trim()).length > 1;
          if (multiHeadlines || multiTexts) {
            toast.error(`Ad "${ad.name}" in "${adSet.name}" has multiple headlines/texts but the adset template doesn't have Dynamic Creative enabled. Enable it in the template or use only 1 headline and 1 primary text per ad.`);
            return;
          }
        }
      }
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
              url: adTemplate?.conversionDomain || '',
              call_to_action: adTemplate?.callToAction || 'SHOP_NOW',
              url_parameters: adTemplate?.urlParameters || '',
              lead_form_id: ad.leadFormId || null,
              square_image_url: ad.creative.type === 'SINGLE_IMAGE'
                ? (ad.creative.singleImage?.squareUrl || null)
                : null,
              story_image_url: ad.creative.type === 'SINGLE_IMAGE'
                ? (ad.creative.singleImage?.storyVariants.find(v => v.id === ad.creative.singleImage?.selectedStoryId)?.url || null)
                : null,
              video_url: ad.creative.type === 'SINGLE_VIDEO'
                ? (ad.creative.singleVideo?.url || null)
                : null,
              thumbnail_url: ad.creative.type === 'SINGLE_VIDEO'
                ? (ad.creative.singleVideo?.thumbnailUrl || null)
                : null,
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
              advantage_creative_config: advantageTemplate ? {
                image_enhancements: advantageTemplate.imageEnhancements,
                video_enhancements: advantageTemplate.videoEnhancements,
              } : null,
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

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campaign / Ad Builder</h1>
          <p className="text-sm text-muted-foreground mt-1">Select templates, add ad copies and launch your campaign</p>
        </div>

        {/* Document Import */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import Ad Texts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Upload a .docx document with ad texts. The system automatically recognizes campaigns, audiences, ad sets and text variants and fills in everything below.
            </p>
            <DocumentImport onImport={handleDocumentImport} />
          </CardContent>
        </Card>

        {/* 1. Base Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Base Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <AccountSelector value={accountId} onChange={setAccountId} />
              <div>
                <Label>Campaign Type</Label>
                <RadioGroup
                  value={campaignType}
                  onValueChange={(v) => setCampaignType(v as 'new' | 'existing')}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="new" id="new-campaign" />
                    <Label htmlFor="new-campaign" className="font-normal cursor-pointer">New Campaign</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="existing" id="existing-campaign" />
                    <Label htmlFor="existing-campaign" className="font-normal cursor-pointer">Existing Campaign</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

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
                    <Label>Campaign Template</Label>
                    <Select value={campaignTemplateId} onValueChange={setCampaignTemplateId}>
                      <SelectTrigger className="mt-1.5">
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
                  </div>
                </div>
              </>
            ) : (
              <div className="max-w-md">
                <Label>Existing Campaign ID</Label>
                <Input
                  value={existingCampaignId}
                  onChange={e => setExistingCampaignId(e.target.value)}
                  placeholder="Enter the Campaign ID"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">The ID of the existing campaign in Meta</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Ad Sets & Ads */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">2. Ad Sets & Ads</h2>

          <div className="space-y-6">
            {adSets.map((adSet, adSetIndex) => (
              <Card key={adSet.id} className="border-primary/30">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-primary">Ad Set {adSetIndex + 1}</h3>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => duplicateAdSet(adSet.id)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <Copy className="w-4 h-4" />
                      </Button>
                      {adSets.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeAdSet(adSet.id)} className="text-destructive hover:text-destructive h-8 w-8">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Ad Set Type</Label>
                      <RadioGroup
                        value={adSet.type}
                        onValueChange={(v) => updateAdSet(adSet.id, { type: v as 'new' | 'existing' })}
                        className="flex gap-4 mt-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="new" id={`new-adset-${adSet.id}`} />
                          <Label htmlFor={`new-adset-${adSet.id}`} className="font-normal cursor-pointer text-sm">New</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="existing" id={`existing-adset-${adSet.id}`} />
                          <Label htmlFor={`existing-adset-${adSet.id}`} className="font-normal cursor-pointer text-sm">Existing</Label>
                        </div>
                      </RadioGroup>
                    </div>
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
                        <Label className="text-xs text-muted-foreground">Existing Ad Set ID</Label>
                        <Input
                          value={adSet.existingAdsetId}
                          onChange={e => updateAdSet(adSet.id, { existingAdsetId: e.target.value })}
                          placeholder="Enter the Ad Set ID"
                          className="mt-1.5"
                        />
                      </div>
                    )}
                  </div>

                  {adSet.type === 'new' && (
                    <div className="max-w-xs">
                      <Label className="text-xs text-muted-foreground">Adset Template</Label>
                      <Select value={adSet.adsetTemplateId} onValueChange={v => updateAdSet(adSet.id, { adsetTemplateId: v })}>
                        <SelectTrigger className="mt-1.5 bg-primary/10 border-primary/30 text-foreground">
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
                    </div>
                  )}

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
                                <div>
                                  <Label className="text-xs text-muted-foreground">Product Set ID (Optional)</Label>
                                  <Input value={ad.productSetId} onChange={e => updateAd(adSet.id, ad.id, { productSetId: e.target.value })} placeholder="Product Set ID (Optional)" className="mt-1" />
                                </div>
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
                                  <Label className="text-xs text-muted-foreground">Ad Template</Label>
                                  <Select value={ad.adTemplateId} onValueChange={v => updateAd(adSet.id, ad.id, { adTemplateId: v })}>
                                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select Ad Template" /></SelectTrigger>
                                    <SelectContent>
                                      {adStore.items.length === 0 ? (
                                        <SelectItem value="_none" disabled>No templates</SelectItem>
                                      ) : adStore.items.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Advantage+ Creative</Label>
                                  <Select value={ad.advantageCreativeId} onValueChange={v => updateAd(adSet.id, ad.id, { advantageCreativeId: v })}>
                                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select Advantage+ Template" /></SelectTrigger>
                                    <SelectContent>
                                      {advantageStore.items.length === 0 ? (
                                        <SelectItem value="_none" disabled>No templates</SelectItem>
                                      ) : advantageStore.items.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {/* Headlines */}
                              <div>
                                <Label className="text-sm font-medium">Headlines</Label>
                                <div className="space-y-2 mt-1.5">
                                  {ad.headlines.map((h, i) => (
                                    <Input key={i} value={h} onChange={e => updateHeadline(adSet.id, ad.id, i, e.target.value)} placeholder={`Headline ${i + 1}`} />
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
                                    <Input key={i} value={t} onChange={e => updatePrimaryText(adSet.id, ad.id, i, e.target.value)} placeholder={`Primary text ${i + 1}`} />
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
                            </>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Button variant="outline" size="sm" onClick={() => addAd(adSet.id)} className="border-primary/30 text-primary hover:bg-primary/10">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add New Ad
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={addAdSet} className="mt-4 border-primary/30 text-primary hover:bg-primary/10">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Another Ad Set
          </Button>
        </div>

        {/* Start Campaign Button */}
        <div className="flex justify-end pt-4">
          <Button size="lg" className="px-8" onClick={handleStartCampaign} disabled={isLaunching || !accountId}>
            {isLaunching ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Launching...</>
            ) : (
              'Start Campaign'
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
