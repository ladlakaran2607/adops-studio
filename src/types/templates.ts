export type DetailedTargetingType =
  | 'interests'
  | 'behaviors'
  | 'life_events'
  | 'industries'
  | 'income'
  | 'family_statuses';

export interface DetailedTargetingEntry {
  id: string;                              // Meta targeting ID (numeric, but kept as string)
  name: string;                            // Display name (e.g. "Online shopping")
  type: DetailedTargetingType;             // Which of the three buckets
  path?: string[];                         // Breadcrumb from Meta (e.g. ["Interests", "Shopping"])
  audience_size_lower_bound?: number;
  audience_size_upper_bound?: number;
}

export interface GeoLocationEntry {
  key: string;                           // Meta geo key (e.g., "2506137" for city, "NL" for country)
  name: string;                          // Display name
  type: 'city' | 'country' | 'region';
  country_code?: string;                 // From Meta API response
  region_name?: string;                  // For cities: parent region name
  radius?: number;                       // Cities only (default 25)
  distance_unit?: 'kilometer' | 'mile';  // Cities only (default 'kilometer')
}

export interface CampaignTemplate {
  id: string;
  name: string;
  campaignObjective: string;
  buyingType: string;
  bidStrategy: string;
  bidAmount: number | null;
  advantagePlusCatalog: boolean;
  catalogId: string;
  advantageCampaignBudget: boolean;
  campaignBudgetType: string;
  campaignBudgetValue: number | null;
  abTest: boolean;
  specialAdCategories: string[];
  spendCap: number | null;
  campaignStatus: string;
  isAdsetBudgetSharing: boolean;
  createdAt: string;
}

export interface AdsetTemplate {
  id: string;
  name: string;
  optimization: string;
  adsetConversionLocation: string;
  adsetPerformanceGoals: string;
  adsetConversionEvent: string;
  dynamicCreative: boolean;
  bidStrategy: string;
  bidAmount: number | null;
  adsetBudgetType: string;
  adsetBudgetValue: number | null;
  startDate: string;
  setEndDate: boolean;
  endDate: string;
  targetGender: string;
  targetAge: string;
  location: string;
  excludedLocation: string;
  detailedTargeting: string;
  placements: string;
  placementOptions: PlacementOptions;
  attributionSetting: string;
  promotedObjectType: string;
  pixelId: string;
  createdAt: string;
}

export interface PlacementOptions {
  facebookFeed: boolean;
  facebookProfileFeed: boolean;
  instagramFeed: boolean;
  instagramProfileFeed: boolean;
  facebookMarketplace: boolean;
  facebookVideoFeeds: boolean;
  facebookRightColumn: boolean;
  instagramExplore: boolean;
  instagramExploreHome: boolean;
  facebookBusinessExplore: boolean;
  instagramStories: boolean;
  facebookStories: boolean;
  facebookReels: boolean;
  instagramReels: boolean;
  instagramProfileReels: boolean;
  facebookInStreamVideos: boolean;
  adsOnFacebookReels: boolean;
}

export interface AdTemplate {
  id: string;
  name: string;
  creativeType: string;
  callToAction: string;
  urlParameters: string;
  conversionDomain: string;
  trackingPixelId: string;
  createdAt: string;
}

// --- Advantage+ Creative Enhancements (per format) ---
export interface ImageEnhancements {
  advantageCreative: boolean;
  visualTouchups: boolean;
  adjustBrightnessContrast: boolean;
  textTranslation: boolean;
  imageAnimation: boolean;   // 3D Animation
  music: boolean;
  flexibleMedia: boolean;
  enhanceCta: boolean;
  addOverlays: boolean;
  expandImage: boolean;
  textImprovements: boolean;
  relevantComments: boolean;
  addProductTags: boolean;
  addCatalogItems: boolean;
}

export interface VideoEnhancements {
  advantageCreative: boolean;
  visualTouchups: boolean;
  videoEffects: boolean;
  textTranslation: boolean;
  videoToImage: boolean;
  flexibleMedia: boolean;
  enhanceCta: boolean;
  textImprovements: boolean;
  relevantComments: boolean;
  music: boolean;
  addProductTags: boolean;
  addCatalogItems: boolean;
}

export interface CarouselEnhancements {
  advantageCreative: boolean;
  formatAutomation: boolean;
  photosToVideo: boolean;
  highlightCard: boolean;
  dynamicDescription: boolean;
  profileEndCard: boolean;
  expandImage: boolean;
  addOverlays: boolean;
  enhanceCta: boolean;
  textImprovements: boolean;
  relevantComments: boolean;
}

export interface CatalogEnhancements {
  adaptToPlacement: boolean;
  dynamicMedia: boolean;
  dynamicDescription: boolean;
  dynamicOverlays: boolean;
  generateBackground: boolean;
  siteLinks: boolean;
}

export interface AdvantageCreativeTemplate {
  id: string;
  name: string;
  imageEnhancements: ImageEnhancements;
  videoEnhancements: VideoEnhancements;
  carouselEnhancements: CarouselEnhancements;
  catalogEnhancements: CatalogEnhancements;
  createdAt: string;
}

export interface AIEnhancementRule {
  id: string;
  name: string;
  ruleType: string;
  conditions: string;
  actions: string;
  enabled: boolean;
  createdAt: string;
}

export type TemplateType = 'campaign' | 'adset' | 'ad' | 'advantage-creative' | 'ai-rules';
