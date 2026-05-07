import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { CampaignTemplate, AdsetTemplate, AdTemplate, AdvantageCreativeTemplate, AIEnhancementRule, PlacementOptions, ImageEnhancements, VideoEnhancements, CarouselEnhancements, CatalogEnhancements } from '@/types/templates';

// ── Default values (used when creating new templates) ──

const defaultPlacements: PlacementOptions = {
  facebookFeed: false, facebookProfileFeed: false, instagramFeed: false,
  instagramProfileFeed: false, facebookMarketplace: false, facebookVideoFeeds: false,
  facebookRightColumn: false, instagramExplore: false, instagramExploreHome: false,
  facebookBusinessExplore: false, instagramStories: false, facebookStories: false,
  facebookReels: false, instagramReels: false, instagramProfileReels: false,
  facebookInStreamVideos: false, adsOnFacebookReels: false,
};

const defaultImageEnhancements: ImageEnhancements = {
  advantageCreative: true, visualTouchups: true, adjustBrightnessContrast: true,
  textTranslation: true, imageAnimation: false, music: false,
  flexibleMedia: true, enhanceCta: false, addOverlays: false,
  expandImage: false, textImprovements: false, relevantComments: true,
  addProductTags: false, addCatalogItems: false,
};

const defaultVideoEnhancements: VideoEnhancements = {
  advantageCreative: true, visualTouchups: false, videoEffects: false,
  textTranslation: true, videoToImage: false, flexibleMedia: true,
  enhanceCta: false, textImprovements: false, relevantComments: true,
  music: false, addProductTags: false, addCatalogItems: false,
};

const defaultCarouselEnhancements: CarouselEnhancements = {
  advantageCreative: true, formatAutomation: false, photosToVideo: false,
  highlightCard: false, dynamicDescription: true, profileEndCard: false,
  expandImage: false, addOverlays: false, enhanceCta: false,
  textImprovements: false, relevantComments: true,
};

const defaultCatalogEnhancements: CatalogEnhancements = {
  adaptToPlacement: true, dynamicMedia: true, dynamicDescription: true,
  dynamicOverlays: false, generateBackground: false, siteLinks: false,
};

// ── Empty template creators ──

export function createEmptyCampaignTemplate(): Omit<CampaignTemplate, 'id' | 'createdAt'> {
  return {
    name: '', campaignObjective: '', buyingType: 'AUCTION', bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
    bidAmount: null, advantagePlusCatalog: false, catalogId: '', advantageCampaignBudget: false,
    campaignBudgetType: 'Daily', campaignBudgetValue: null, abTest: false,
    specialAdCategories: [], spendCap: null, campaignStatus: 'PAUSED',
    isAdsetBudgetSharing: false,
  };
}

export function createEmptyAdsetTemplate(): Omit<AdsetTemplate, 'id' | 'createdAt'> {
  return {
    name: '', optimization: 'Conversions', adsetConversionLocation: 'Website',
    adsetPerformanceGoals: 'Maximize number of conversions', adsetConversionEvent: 'Purchase',
    dynamicCreative: false, bidStrategy: 'LOWEST_COST_WITHOUT_CAP', bidAmount: null,
    adsetBudgetType: 'Daily', adsetBudgetValue: null,
    startDate: '', setEndDate: false, endDate: '',
    targetGender: 'All', targetAge: '18-65+',
    location: '', excludedLocation: '',
    detailedTargeting: '',
    placements: 'Automatic', placementOptions: { ...defaultPlacements },
    attributionSetting: '7d_click_1d_view', promotedObjectType: 'PIXEL',
    pixelId: '',
  };
}

export function createEmptyAdTemplate(): Omit<AdTemplate, 'id' | 'createdAt'> {
  return {
    name: '', creativeType: 'SINGLE_IMAGE', callToAction: 'SHOP_NOW',
    urlParameters: '', conversionDomain: '', trackingPixelId: '',
  };
}

export function createEmptyAdvantageCreativeTemplate(): Omit<AdvantageCreativeTemplate, 'id' | 'createdAt'> {
  return {
    name: '',
    imageEnhancements: { ...defaultImageEnhancements },
    videoEnhancements: { ...defaultVideoEnhancements },
    carouselEnhancements: { ...defaultCarouselEnhancements },
    catalogEnhancements: { ...defaultCatalogEnhancements },
  };
}

export function createEmptyAIRule(): Omit<AIEnhancementRule, 'id' | 'createdAt'> {
  return { name: '', ruleType: '', conditions: '', actions: '', enabled: true };
}

// ── Mapping helpers: camelCase ↔ DB columns ──
// New DB tables use camelCase columns, so mapping is mostly identity.
// Only `createdAt` needs remapping since the DB column name matches.

function mapCampaignFromDb(row: Record<string, unknown>): CampaignTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    campaignObjective: row.campaignObjective as string,
    buyingType: row.buyingType as string,
    bidStrategy: row.bidStrategy as string,
    bidAmount: row.bidAmount as number | null,
    advantagePlusCatalog: row.advantagePlusCatalog as boolean,
    catalogId: (row.catalogId as string) || '',
    advantageCampaignBudget: row.advantageCampaignBudget as boolean,
    campaignBudgetType: row.campaignBudgetType as string,
    campaignBudgetValue: row.campaignBudgetValue as number | null,
    abTest: row.abTest as boolean,
    specialAdCategories: (row.specialAdCategories as string[]) || [],
    spendCap: row.spendCap as number | null,
    campaignStatus: row.campaignStatus as string,
    isAdsetBudgetSharing: row.isAdsetBudgetSharing as boolean,
    createdAt: row.createdAt as string,
  };
}

function mapCampaignToDb(t: Partial<CampaignTemplate>) {
  const m: Record<string, unknown> = {};
  if (t.name !== undefined) m.name = t.name;
  if (t.campaignObjective !== undefined) m.campaignObjective = t.campaignObjective;
  if (t.buyingType !== undefined) m.buyingType = t.buyingType;
  if (t.bidStrategy !== undefined) m.bidStrategy = t.bidStrategy;
  if (t.bidAmount !== undefined) m.bidAmount = t.bidAmount;
  if (t.advantagePlusCatalog !== undefined) m.advantagePlusCatalog = t.advantagePlusCatalog;
  if (t.catalogId !== undefined) m.catalogId = t.catalogId;
  if (t.advantageCampaignBudget !== undefined) m.advantageCampaignBudget = t.advantageCampaignBudget;
  if (t.campaignBudgetType !== undefined) m.campaignBudgetType = t.campaignBudgetType;
  if (t.campaignBudgetValue !== undefined) m.campaignBudgetValue = t.campaignBudgetValue;
  if (t.abTest !== undefined) m.abTest = t.abTest;
  if (t.specialAdCategories !== undefined) m.specialAdCategories = t.specialAdCategories;
  if (t.spendCap !== undefined) m.spendCap = t.spendCap;
  if (t.campaignStatus !== undefined) m.campaignStatus = t.campaignStatus;
  if (t.isAdsetBudgetSharing !== undefined) m.isAdsetBudgetSharing = t.isAdsetBudgetSharing;
  return m;
}

function mapAdsetFromDb(row: Record<string, unknown>): AdsetTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    optimization: row.optimization as string,
    adsetConversionLocation: row.adsetConversionLocation as string,
    adsetPerformanceGoals: row.adsetPerformanceGoals as string,
    adsetConversionEvent: row.adsetConversionEvent as string,
    dynamicCreative: row.dynamicCreative as boolean,
    bidStrategy: row.bidStrategy as string,
    bidAmount: row.bidAmount as number | null,
    adsetBudgetType: row.adsetBudgetType as string,
    adsetBudgetValue: row.adsetBudgetValue as number | null,
    startDate: row.startDate as string,
    setEndDate: row.setEndDate as boolean,
    endDate: row.endDate as string,
    targetGender: row.targetGender as string,
    targetAge: row.targetAge as string,
    location: row.location as string,
    excludedLocation: (row.excludedLocation as string) || '',
    detailedTargeting: (row.detailedTargeting as string) || '',
    placements: row.placements as string,
    placementOptions: (row.placementOptions as PlacementOptions) || { ...defaultPlacements },
    attributionSetting: row.attributionSetting as string,
    promotedObjectType: row.promotedObjectType as string,
    pixelId: row.pixelId as string,
    createdAt: row.createdAt as string,
  };
}

function mapAdsetToDb(t: Partial<AdsetTemplate>) {
  const m: Record<string, unknown> = {};
  if (t.name !== undefined) m.name = t.name;
  if (t.optimization !== undefined) m.optimization = t.optimization;
  if (t.adsetConversionLocation !== undefined) m.adsetConversionLocation = t.adsetConversionLocation;
  if (t.adsetPerformanceGoals !== undefined) m.adsetPerformanceGoals = t.adsetPerformanceGoals;
  if (t.adsetConversionEvent !== undefined) m.adsetConversionEvent = t.adsetConversionEvent;
  if (t.dynamicCreative !== undefined) m.dynamicCreative = t.dynamicCreative;
  if (t.bidStrategy !== undefined) m.bidStrategy = t.bidStrategy;
  if (t.bidAmount !== undefined) m.bidAmount = t.bidAmount;
  if (t.adsetBudgetType !== undefined) m.adsetBudgetType = t.adsetBudgetType;
  if (t.adsetBudgetValue !== undefined) m.adsetBudgetValue = t.adsetBudgetValue;
  if (t.startDate !== undefined) m.startDate = t.startDate;
  if (t.setEndDate !== undefined) m.setEndDate = t.setEndDate;
  if (t.endDate !== undefined) m.endDate = t.endDate;
  if (t.targetGender !== undefined) m.targetGender = t.targetGender;
  if (t.targetAge !== undefined) m.targetAge = t.targetAge;
  if (t.location !== undefined) m.location = t.location;
  if (t.excludedLocation !== undefined) m.excludedLocation = t.excludedLocation;
  if (t.detailedTargeting !== undefined) m.detailedTargeting = t.detailedTargeting;
  if (t.placements !== undefined) m.placements = t.placements;
  if (t.placementOptions !== undefined) m.placementOptions = t.placementOptions;
  if (t.attributionSetting !== undefined) m.attributionSetting = t.attributionSetting;
  if (t.promotedObjectType !== undefined) m.promotedObjectType = t.promotedObjectType;
  if (t.pixelId !== undefined) m.pixelId = t.pixelId;
  return m;
}

function mapAdFromDb(row: Record<string, unknown>): AdTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    creativeType: row.creativeType as string,
    callToAction: row.callToAction as string,
    urlParameters: row.urlParameters as string,
    conversionDomain: row.conversionDomain as string,
    trackingPixelId: row.trackingPixelId as string,
    createdAt: row.createdAt as string,
  };
}

function mapAdToDb(t: Partial<AdTemplate>) {
  const m: Record<string, unknown> = {};
  if (t.name !== undefined) m.name = t.name;
  if (t.creativeType !== undefined) m.creativeType = t.creativeType;
  if (t.callToAction !== undefined) m.callToAction = t.callToAction;
  if (t.urlParameters !== undefined) m.urlParameters = t.urlParameters;
  if (t.conversionDomain !== undefined) m.conversionDomain = t.conversionDomain;
  if (t.trackingPixelId !== undefined) m.trackingPixelId = t.trackingPixelId;
  return m;
}

function mapAdvantageFromDb(row: Record<string, unknown>): AdvantageCreativeTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    imageEnhancements: (row.imageEnhancements as ImageEnhancements) || { ...defaultImageEnhancements },
    videoEnhancements: (row.videoEnhancements as VideoEnhancements) || { ...defaultVideoEnhancements },
    carouselEnhancements: (row.carouselEnhancements as CarouselEnhancements) || { ...defaultCarouselEnhancements },
    catalogEnhancements: (row.catalogEnhancements as CatalogEnhancements) || { ...defaultCatalogEnhancements },
    createdAt: row.createdAt as string,
  };
}

function mapAdvantageToDb(t: Partial<AdvantageCreativeTemplate>) {
  const m: Record<string, unknown> = {};
  if (t.name !== undefined) m.name = t.name;
  if (t.imageEnhancements !== undefined) m.imageEnhancements = t.imageEnhancements;
  if (t.videoEnhancements !== undefined) m.videoEnhancements = t.videoEnhancements;
  if (t.carouselEnhancements !== undefined) m.carouselEnhancements = t.carouselEnhancements;
  if (t.catalogEnhancements !== undefined) m.catalogEnhancements = t.catalogEnhancements;
  return m;
}

function mapAIRuleFromDb(row: Record<string, unknown>): AIEnhancementRule {
  return {
    id: row.id as string,
    name: row.name as string,
    ruleType: row.ruleType as string,
    conditions: row.conditions as string,
    actions: row.actions as string,
    enabled: row.enabled as boolean,
    createdAt: row.createdAt as string,
  };
}

function mapAIRuleToDb(t: Partial<AIEnhancementRule>) {
  const m: Record<string, unknown> = {};
  if (t.name !== undefined) m.name = t.name;
  if (t.ruleType !== undefined) m.ruleType = t.ruleType;
  if (t.conditions !== undefined) m.conditions = t.conditions;
  if (t.actions !== undefined) m.actions = t.actions;
  if (t.enabled !== undefined) m.enabled = t.enabled;
  return m;
}

// ── Table config registry ──

type TableName = 'CampaignTemplates' | 'AdsetTemplates' | 'AdTemplates' | 'AdvantageCreativeTemplates' | 'AiEnhancementRules';

interface TableConfig<T> {
  table: TableName;
  fromDb: (row: Record<string, unknown>) => T;
  toDb: (t: Partial<T>) => Record<string, unknown>;
}

const tableConfigs: Record<string, TableConfig<unknown>> = {
  'campaign-templates': { table: 'CampaignTemplates', fromDb: mapCampaignFromDb, toDb: mapCampaignToDb as (t: Partial<unknown>) => Record<string, unknown> },
  'adset-templates': { table: 'AdsetTemplates', fromDb: mapAdsetFromDb, toDb: mapAdsetToDb as (t: Partial<unknown>) => Record<string, unknown> },
  'ad-templates': { table: 'AdTemplates', fromDb: mapAdFromDb, toDb: mapAdToDb as (t: Partial<unknown>) => Record<string, unknown> },
  'advantage-creative-templates': { table: 'AdvantageCreativeTemplates', fromDb: mapAdvantageFromDb, toDb: mapAdvantageToDb as (t: Partial<unknown>) => Record<string, unknown> },
  'ai-rules-templates': { table: 'AiEnhancementRules', fromDb: mapAIRuleFromDb, toDb: mapAIRuleToDb as (t: Partial<unknown>) => Record<string, unknown> },
};

// ── Main hook: replaces localStorage-based useTemplateStore ──

export function useTemplateStore<T extends { id: string }>(key: string) {
  const queryClient = useQueryClient();
  const { organizationId } = useAuth();
  const config = tableConfigs[key] as TableConfig<T> | undefined;

  if (!config) {
    throw new Error(`Unknown template store key: ${key}`);
  }

  const queryKey = [config.table];

  const { data: items = [] } = useQuery<T[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(config.table)
        .select('*')
        .order('createdAt', { ascending: false });
      if (error) throw error;
      return (data || []).map(row => config.fromDb(row as Record<string, unknown>));
    },
  });

  const addMutation = useMutation({
    mutationFn: async (item: T) => {
      const dbData = config.toDb(item as Partial<T>);
      const { error } = await supabase.from(config.table).insert({
        ...dbData,
        tenantId: organizationId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<T> }) => {
      const dbData = config.toDb(updates);
      const { error } = await supabase.from(config.table).update(dbData as Record<string, never>).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(config.table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const add = (item: T) => addMutation.mutate(item);
  const update = (id: string, updates: Partial<T>) => updateMutation.mutate({ id, updates });
  const remove = (id: string) => removeMutation.mutate(id);

  return { items, add, update, remove };
}
