/**
 * Campaign creation service — all business logic that was in meta-create-campaign edge function.
 * Now runs in the browser. Calls Meta API via meta-proxy (access token stays server-side).
 * Saves results to Supabase via the frontend client (through RLS).
 */
import { metaPost, metaGet } from './metaApi';
import { supabase } from '@/integrations/supabase/client';
import { logAdError } from './errorLogger';
import type { GeoLocationEntry } from '@/types/templates';

// ── Placement mapping ──
const PLACEMENT_MAP: Record<string, { platform: string; position: string }> = {
  facebookFeed: { platform: 'facebook', position: 'feed' },
  facebookProfileFeed: { platform: 'facebook', position: 'profile_feed' },
  facebookStories: { platform: 'facebook', position: 'story' },
  facebookMarketplace: { platform: 'facebook', position: 'marketplace' },
  facebookVideoFeeds: { platform: 'facebook', position: 'video_feeds' },
  facebookRightColumn: { platform: 'facebook', position: 'right_hand_column' },
  facebookReels: { platform: 'facebook', position: 'facebook_reels' },
  facebookInStreamVideos: { platform: 'facebook', position: 'instream_video' },
  adsOnFacebookReels: { platform: 'facebook', position: 'facebook_reels_overlay' },
  facebookSearchResults: { platform: 'facebook', position: 'search' },
  instagramFeed: { platform: 'instagram', position: 'stream' },
  instagramProfileFeed: { platform: 'instagram', position: 'profile_feed' },
  instagramExplore: { platform: 'instagram', position: 'explore' },
  instagramExploreHome: { platform: 'instagram', position: 'explore_home' },
  instagramStories: { platform: 'instagram', position: 'story' },
  instagramReels: { platform: 'instagram', position: 'reels' },
  instagramSearchResults: { platform: 'instagram', position: 'ig_search' },
  messengerHome: { platform: 'messenger', position: 'messenger_home' },
  messengerSponsoredMessages: { platform: 'messenger', position: 'sponsored_messages' },
  audienceNetworkClassic: { platform: 'audience_network', position: 'classic' },
  audienceNetworkRewarded: { platform: 'audience_network', position: 'rewarded_video' },
};

// ── Country mapping ──
const COUNTRY_MAP: Record<string, string> = {
  afghanistan: 'AF', albania: 'AL', algeria: 'DZ', argentina: 'AR',
  australia: 'AU', austria: 'AT', bangladesh: 'BD', belgium: 'BE',
  brazil: 'BR', bulgaria: 'BG', canada: 'CA', chile: 'CL',
  china: 'CN', colombia: 'CO', croatia: 'HR', 'czech republic': 'CZ',
  czechia: 'CZ', denmark: 'DK', egypt: 'EG', estonia: 'EE',
  finland: 'FI', france: 'FR', germany: 'DE', greece: 'GR',
  'hong kong': 'HK', hungary: 'HU', india: 'IN', indonesia: 'ID',
  ireland: 'IE', israel: 'IL', italy: 'IT', japan: 'JP',
  kenya: 'KE', latvia: 'LV', lithuania: 'LT', luxembourg: 'LU',
  malaysia: 'MY', mexico: 'MX', morocco: 'MA', netherlands: 'NL',
  'new zealand': 'NZ', nigeria: 'NG', norway: 'NO', pakistan: 'PK',
  peru: 'PE', philippines: 'PH', poland: 'PL', portugal: 'PT',
  romania: 'RO', russia: 'RU', 'saudi arabia': 'SA', singapore: 'SG',
  slovakia: 'SK', slovenia: 'SI', 'south africa': 'ZA', 'south korea': 'KR',
  spain: 'ES', sweden: 'SE', switzerland: 'CH', taiwan: 'TW',
  thailand: 'TH', turkey: 'TR', turkiye: 'TR', ukraine: 'UA',
  'united arab emirates': 'AE', uae: 'AE', 'united kingdom': 'GB', uk: 'GB',
  'united states': 'US', usa: 'US', vietnam: 'VN',
};

/** Parse location string: JSON array (new) or comma-separated country names (legacy) */
function parseLocations(locationStr: string): GeoLocationEntry[] {
  if (!locationStr?.trim()) return [];
  const trimmed = locationStr.trim();

  // New format: JSON array of GeoLocationEntry
  if (trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as GeoLocationEntry[];
    } catch {
      return [];
    }
  }

  // Legacy format: comma-separated country names → resolve via COUNTRY_MAP
  const parts = trimmed.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const entries: GeoLocationEntry[] = [];
  for (const part of parts) {
    let code: string | undefined;
    if (part.length === 2 && /^[a-z]{2}$/.test(part)) {
      code = part.toUpperCase();
    } else if (COUNTRY_MAP[part]) {
      code = COUNTRY_MAP[part];
    }
    if (code) {
      entries.push({ key: code, name: part, type: 'country', country_code: code });
    } else {
      console.warn(`[LOCATION] Unknown country: "${part}" — skipping`);
    }
  }
  return entries;
}

// ── Targeting ──
function buildTargetingSpec(
  placements: string,
  placementOptions: Record<string, boolean> | null,
  opts: { targetGender?: string; targetAge?: string; location?: string }
): Record<string, unknown> {
  const targeting: Record<string, unknown> = {};

  // Location: cities, countries, regions
  const entries = parseLocations(opts.location || '');
  if (entries.length > 0) {
    const cities = entries.filter(e => e.type === 'city');
    const countries = entries.filter(e => e.type === 'country');
    const regions = entries.filter(e => e.type === 'region');

    const geoLocations: Record<string, unknown> = {};
    if (cities.length) {
      geoLocations.cities = cities.map(c => ({
        key: c.key,
        radius: c.radius || 25,
        distance_unit: c.distance_unit || 'kilometer',
      }));
    }
    if (countries.length) {
      geoLocations.countries = countries.map(c => c.key);
    }
    if (regions.length) {
      geoLocations.regions = regions.map(r => ({ key: r.key }));
    }
    if (Object.keys(geoLocations).length > 0) {
      targeting.geo_locations = geoLocations;
    }
  }

  if (opts.targetAge) {
    const parts = opts.targetAge.replace('+', '').split('-');
    targeting.age_min = parseInt(parts[0]) || 18;
    targeting.age_max = parseInt(parts[1]) || 65;
  }

  if (opts.targetGender === 'Male') targeting.genders = [1];
  else if (opts.targetGender === 'Female') targeting.genders = [2];

  // Meta v22.0 requires advantage_audience to be explicitly set
  targeting.targeting_automation = { advantage_audience: 0 };

  if (placements === 'Manual' && placementOptions) {
    const platforms: Record<string, string[]> = {};
    for (const [key, enabled] of Object.entries(placementOptions)) {
      if (!enabled) continue;
      const mapping = PLACEMENT_MAP[key];
      if (!mapping) continue;
      if (!platforms[mapping.platform]) platforms[mapping.platform] = [];
      platforms[mapping.platform].push(mapping.position);
    }
    const publisherPlatforms = Object.keys(platforms);
    if (publisherPlatforms.length > 0) {
      targeting.publisher_platforms = publisherPlatforms;
      for (const [platform, positions] of Object.entries(platforms)) {
        targeting[`${platform}_positions`] = positions;
      }
    }
  }

  return targeting;
}

// ── Derivation helpers ──
function deriveOptimizationGoal(objective: string, conversionLocation?: string, templateOptimization?: string): string {
  // Direct mapping from template optimization goal if explicitly set
  if (templateOptimization === 'Lead Generation') return 'LEAD_GENERATION';
  if (templateOptimization === 'Link Clicks') return 'LINK_CLICKS';
  if (templateOptimization === 'Reach') return 'REACH';
  if (templateOptimization === 'Impressions') return 'IMPRESSIONS';
  if (templateOptimization === 'Landing Page Views') return 'LANDING_PAGE_VIEWS';
  if (templateOptimization === 'Value') return 'VALUE';
  // Fallback: derive from campaign objective + conversion location
  if (objective === 'OUTCOME_SALES') return 'OFFSITE_CONVERSIONS';
  if (objective === 'OUTCOME_LEADS' && conversionLocation === 'On Ad') return 'LEAD_GENERATION';
  if (objective === 'OUTCOME_LEADS') return 'OFFSITE_CONVERSIONS';
  if (objective === 'OUTCOME_AWARENESS') return 'REACH';
  if (objective === 'OUTCOME_TRAFFIC') return 'LINK_CLICKS';
  return 'OFFSITE_CONVERSIONS';
}

function parseAttributionSetting(setting: string): Array<{ event_type: string; window_days: number }> {
  const spec: Array<{ event_type: string; window_days: number }> = [];
  const clickMatch = setting.match(/(\d+)d_click/);
  if (clickMatch) spec.push({ event_type: 'CLICK_THROUGH', window_days: parseInt(clickMatch[1]) });
  const viewMatch = setting.match(/(\d+)d_view/);
  if (viewMatch) spec.push({ event_type: 'VIEW_THROUGH', window_days: parseInt(viewMatch[1]) });
  if (spec.length === 0) {
    spec.push({ event_type: 'CLICK_THROUGH', window_days: 7 }, { event_type: 'VIEW_THROUGH', window_days: 1 });
  }
  return spec;
}

function derivePromotedObject(
  objective: string,
  convLoc: string | undefined,
  pixelId: string | undefined,
  pageId: string | undefined
): Record<string, string> | null {
  if (objective === 'OUTCOME_SALES') return pixelId ? { pixel_id: pixelId, custom_event_type: 'PURCHASE' } : null;
  if (objective === 'OUTCOME_LEADS' && convLoc === 'On Ad') return pageId ? { page_id: pageId } : null;
  if (objective === 'OUTCOME_LEADS') return pixelId ? { pixel_id: pixelId, custom_event_type: 'LEAD' } : null;
  if (objective === 'OUTCOME_AWARENESS') return pageId ? { page_id: pageId } : null;
  return null;
}

// ══════════════════════════════════════════════════════════════════
// Creative builders
// ══════════════════════════════════════════════════════════════════

interface CreativeCtx {
  pageId: string;
  instagramId: string | null;
  adSetConvLoc: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdInput = Record<string, any>;

/**
 * 1. SIMPLE IMAGE — object_story_spec with picture URL
 *    Used when: SINGLE_IMAGE + no story variant + single text
 *    Returns inline creative spec for the ads POST endpoint.
 */
function buildSimpleImageCreative(ad: AdInput, ctx: CreativeCtx): Record<string, unknown> {
  const isLeadAd = ctx.adSetConvLoc === 'On Ad' && ad.lead_form_id;
  const ctaValue = isLeadAd
    ? { link: 'http://fb.me/', lead_gen_form_id: ad.lead_form_id }
    : { link: ad.url || '' };

  const linkData: Record<string, unknown> = {
    message: (ad.primary_texts || [])[0] || '',
    link: isLeadAd ? 'http://fb.me/' : (ad.url || ''),
    call_to_action: { type: ad.call_to_action || 'SHOP_NOW', value: ctaValue },
  };

  const headline = (ad.headlines || [])[0];
  if (headline) linkData.name = headline;
  if (ad.square_image_url) linkData.picture = ad.square_image_url;

  return {
    object_story_spec: {
      page_id: ctx.pageId,
      ...(ctx.instagramId ? { instagram_user_id: ctx.instagramId } : {}),
      link_data: linkData,
    },
  };
}

/**
 * 2. SIMPLE CAROUSEL — object_story_spec with child_attachments using picture URLs
 *    Used when: CAROUSEL + no story variants
 */
function buildSimpleCarouselCreative(ad: AdInput, ctx: CreativeCtx): Record<string, unknown> {
  const isLeadAd = ctx.adSetConvLoc === 'On Ad' && ad.lead_form_id;

  const childAttachments = (ad.carousel_cards || [])
    .filter((c: AdInput) => c.image_url)
    .map((c: AdInput) => {
      const child: Record<string, unknown> = {
        name: c.title || '',
        link: c.url || ad.url || '',
        picture: c.image_url,
      };
      if (isLeadAd) {
        child.call_to_action = {
          type: ad.call_to_action || 'SIGN_UP',
          value: { lead_gen_form_id: ad.lead_form_id },
        };
      }
      return child;
    });

  const ctaValue = isLeadAd
    ? { lead_gen_form_id: ad.lead_form_id }
    : { link: ad.url || '' };

  const linkData: Record<string, unknown> = {
    message: (ad.primary_texts || [])[0] || '',
    link: ad.url || '',
    child_attachments: childAttachments,
    call_to_action: { type: ad.call_to_action || 'SHOP_NOW', value: ctaValue },
  };

  if (isLeadAd) linkData.multi_share_optimized = true;

  return {
    object_story_spec: {
      page_id: ctx.pageId,
      ...(ctx.instagramId ? { instagram_user_id: ctx.instagramId } : {}),
      link_data: linkData,
    },
  };
}

/**
 * 3. ASSET FEED IMAGE — asset_feed_spec with URL-based images
 *    Used when: SINGLE_IMAGE + (story variant OR multiple texts)
 *    Supports placement-based image assignment (feed vs story) and lead ads.
 */
function buildAssetFeedImageCreative(ad: AdInput, ctx: CreativeCtx): Record<string, unknown> {
  const isLeadAd = ctx.adSetConvLoc === 'On Ad' && ad.lead_form_id;
  const hasStory = !!ad.story_image_url;
  const headlines = ad.headlines || [];
  const primaryTexts = ad.primary_texts || [];

  // ── Images ──
  // Always use adlabels + placement rules so asset_feed_spec works without
  // is_dynamic_creative on the ad set. When no story variant exists, the
  // feed image is reused for story/reels placements.
  const images: Array<Record<string, unknown>> = [];
  if (ad.square_image_url) {
    images.push({
      url: ad.square_image_url,
      adlabels: [{ name: 'feed_image' }],
      image_crops: { '100x100': [[0, 0], [1080, 1080]] },
    });
  }
  if (hasStory) {
    images.push({
      url: ad.story_image_url,
      adlabels: [{ name: 'story_image' }],
      image_crops: { '90x160': [[0, 0], [1080, 1920]] },
    });
  } else if (ad.square_image_url) {
    // No story variant — reuse feed image for story/reels placements.
    images.push({
      url: ad.square_image_url,
      adlabels: [{ name: 'story_image' }],
    });
  }

  // ── Titles & Bodies ──
  // All variants share the same adlabel so every placement rule uses ALL of them.
  const titles = headlines.map((t: string) => ({
    text: t,
    adlabels: [{ name: 'title_var_1' }],
  }));

  const bodies = primaryTexts.map((t: string) => ({
    text: t,
    adlabels: [{ name: 'body_var_1' }],
  }));

  // ── Asset feed spec ──
  const assetFeedSpec: Record<string, unknown> = {
    ad_formats: ['SINGLE_IMAGE'],
    images,
    titles,
    bodies,
    descriptions: [{ text: ' ' }],
    call_to_action_types: [ad.call_to_action || (isLeadAd ? 'SIGN_UP' : 'SHOP_NOW')],
    link_urls: [{ website_url: isLeadAd ? 'http://fb.me/' : (ad.url || '') }],
  };

  // Lead ad: add call_to_actions with lead_gen_form_id
  if (isLeadAd) {
    assetFeedSpec.call_to_actions = [{
      type: ad.call_to_action || 'SIGN_UP',
      value: { lead_gen_form_id: ad.lead_form_id },
    }];
  }

  // ── Asset customization rules — always present ──
  const storyImageLabel = hasStory ? 'story_image' : 'story_image';
  const feedRule: Record<string, unknown> = {
    image_label: { name: 'feed_image' },
    title_label: { name: 'title_var_1' },
    body_label: { name: 'body_var_1' },
    customization_spec: {
      publisher_platforms: ['facebook', 'instagram'],
      facebook_positions: ['feed'],
      instagram_positions: ['stream', 'explore', 'explore_home'],
    },
  };

  const storyRule: Record<string, unknown> = {
    image_label: { name: storyImageLabel },
    title_label: { name: 'title_var_1' },
    body_label: { name: 'body_var_1' },
    customization_spec: {
      publisher_platforms: ['facebook', 'instagram'],
      facebook_positions: ['story', 'facebook_reels'],
      instagram_positions: ['story', 'reels'],
    },
  };

  assetFeedSpec.asset_customization_rules = [feedRule, storyRule];
  assetFeedSpec.optimization_type = 'PLACEMENT';

  // ── Final creative spec ──
  const spec: Record<string, unknown> = {
    object_story_spec: {
      page_id: ctx.pageId,
      ...(ctx.instagramId ? { instagram_user_id: ctx.instagramId } : {}),
    },
    asset_feed_spec: assetFeedSpec,
  };

  return spec;
}

/**
 * 4. ASSET FEED CAROUSEL — asset_feed_spec with ad_formats: ['CAROUSEL']
 *    Used when: CAROUSEL + at least one card has a story variant OR multiple texts.
 *    Supports per-card feed/story images, per-card titles and URLs,
 *    shared body texts, and placement-based carousel assignment.
 */
function buildAssetFeedCarouselCreative(ad: AdInput, ctx: CreativeCtx): Record<string, unknown> {
  const isLeadAd = ctx.adSetConvLoc === 'On Ad' && ad.lead_form_id;
  const cards: AdInput[] = ad.carousel_cards || [];
  const primaryTexts: string[] = ad.primary_texts || [];

  // ── Images (per card: feed 1:1 + optional story 9:16) ──
  const images: Array<Record<string, unknown>> = [];
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const n = i + 1;
    if (card.image_url) {
      images.push({
        url: card.image_url,
        adlabels: [{ name: `img_feed_${n}` }],
        image_crops: { '100x100': [[0, 0], [1080, 1080]] },
      });
    }
    if (card.story_image_url) {
      images.push({
        url: card.story_image_url,
        adlabels: [{ name: `img_story_${n}` }],
        image_crops: { '90x160': [[0, 0], [1080, 1920]] },
      });
    }
  }

  // ── Titles (deduplicated — Meta rejects duplicate text in titles[]) ──
  // Cards with identical titles share one titles[] entry + label.
  const titleTextToLabel = new Map<string, string>();
  const titles: Array<{ text: string; adlabels: Array<{ name: string }> }> = [];
  const cardTitleLabels: string[] = []; // per-card label lookup
  cards.forEach((card: AdInput) => {
    const text = card.title || '';
    if (!titleTextToLabel.has(text)) {
      const label = `title_${titles.length + 1}`;
      titleTextToLabel.set(text, label);
      titles.push({ text, adlabels: [{ name: label }] });
    }
    cardTitleLabels.push(titleTextToLabel.get(text)!);
  });

  // ── Bodies — carousel asset_feed_spec only supports ONE body.
  // Multiple bodies cause Meta to reject with "Multiple bodies assets cannot
  // be applied to the carousel child attachment" because each carousel renders
  // one body at the ad level, not per-card. We take the first non-empty entry.
  const firstBody = primaryTexts.find((t: string) => t?.trim()) || ' ';
  const bodies = [{ text: firstBody, adlabels: [{ name: 'body_1' }] }];

  // ── Link URLs (deduplicated — same logic as titles) ──
  const linkTextToLabel = new Map<string, string>();
  const linkUrls: Array<{ website_url: string; adlabels: Array<{ name: string }> }> = [];
  const cardLinkLabels: string[] = [];
  cards.forEach((card: AdInput) => {
    const url = isLeadAd ? 'http://fb.me/' : (card.url || ad.url || '');
    if (!linkTextToLabel.has(url)) {
      const label = `link_store_${linkUrls.length + 1}`;
      linkTextToLabel.set(url, label);
      linkUrls.push({ website_url: url, adlabels: [{ name: label }] });
    }
    cardLinkLabels.push(linkTextToLabel.get(url)!);
  });

  // ── Build child_attachments for each carousel variant ──
  const hasAnyStory = cards.some((card: AdInput) => !!card.story_image_url);

  // Note: body_label is intentionally NOT bound to child_attachments. Binding
  // bodies[] per-card makes Meta treat them as per-card descriptions, which
  // don't render in story/reels carousel placements. Leaving bodies[] purely
  // at the ad level lets it serve as the ad's primary text across all placements.
  const buildChildAttachments = (variant: 'feed' | 'story') =>
    cards.map((card: AdInput, i: number) => {
      const n = i + 1;
      const imgLabel = variant === 'story' && card.story_image_url
        ? `img_story_${n}` : `img_feed_${n}`;
      return {
        image_label: { name: imgLabel },
        title_label: { name: cardTitleLabels[i] },
        link_url_label: { name: cardLinkLabels[i] },
      };
    });

  // ── Carousels array ──
  const carousels: Array<Record<string, unknown>> = [
    {
      multi_share_end_card: 'false',
      multi_share_optimized: 'false',
      adlabels: [{ name: 'CAROUSEL_FEED' }],
      child_attachments: buildChildAttachments('feed'),
    },
  ];

  if (hasAnyStory) {
    carousels.push({
      multi_share_end_card: 'false',
      multi_share_optimized: 'false',
      adlabels: [{ name: 'CAROUSEL_STORY' }],
      child_attachments: buildChildAttachments('story'),
    });
  }

  // ── Asset feed spec ──
  const assetFeedSpec: Record<string, unknown> = {
    ad_formats: ['CAROUSEL'],
    images,
    titles,
    bodies,
    descriptions: [{ text: ' ' }],
    call_to_action_types: [ad.call_to_action || (isLeadAd ? 'SIGN_UP' : 'SHOP_NOW')],
    link_urls: linkUrls,
    carousels,
  };

  // Lead ad: add call_to_actions with lead_gen_form_id
  if (isLeadAd) {
    assetFeedSpec.call_to_actions = [{
      type: ad.call_to_action || 'SIGN_UP',
      value: { lead_gen_form_id: ad.lead_form_id },
    }];
  }

  // Placement optimization rules — always required for carousel asset_feed_spec.
  // Each rule must reference body_label + link_url_label so Meta knows which
  // primary text and CTA link to render for that placement. Without the
  // body_label binding at the rule level:
  //   - Multi-body carousels throw "Multiple bodies assets cannot be applied
  //     to the carousel child attachment" because Meta can't figure out which
  //     body to use per placement.
  //   - Story/reels carousels render without primary text.
  const bodyLabelName = (bodies[0]?.adlabels?.[0]?.name as string) || 'body_1';
  const firstLinkLabel = cardLinkLabels[0] || 'link_store_1';
  if (hasAnyStory) {
    assetFeedSpec.asset_customization_rules = [
      {
        carousel_label: { name: 'CAROUSEL_FEED' },
        body_label: { name: bodyLabelName },
        link_url_label: { name: firstLinkLabel },
        priority: 2,
        customization_spec: {
          publisher_platforms: ['facebook', 'instagram'],
          facebook_positions: ['feed'],
          instagram_positions: ['stream', 'explore', 'explore_home'],
        },
      },
      {
        carousel_label: { name: 'CAROUSEL_STORY' },
        body_label: { name: bodyLabelName },
        link_url_label: { name: firstLinkLabel },
        priority: 1,
        customization_spec: {
          publisher_platforms: ['facebook', 'instagram'],
          facebook_positions: ['story', 'facebook_reels'],
          instagram_positions: ['story', 'reels'],
        },
      },
    ];
    assetFeedSpec.optimization_type = 'PLACEMENT';
  } else {
    // No story variants — single rule covering all placements so multi-body
    // carousels work without needing is_dynamic_creative on the ad set.
    assetFeedSpec.asset_customization_rules = [
      {
        carousel_label: { name: 'CAROUSEL_FEED' },
        body_label: { name: bodyLabelName },
        link_url_label: { name: firstLinkLabel },
        priority: 1,
        customization_spec: {
          publisher_platforms: ['facebook', 'instagram'],
        },
      },
    ];
    assetFeedSpec.optimization_type = 'PLACEMENT';
  }

  // ── Final creative spec ──
  const spec: Record<string, unknown> = {
    object_story_spec: {
      page_id: ctx.pageId,
      ...(ctx.instagramId ? { instagram_user_id: ctx.instagramId } : {}),
    },
    asset_feed_spec: assetFeedSpec,
  };

  return spec;
}

// ══════════════════════════════════════════════════════════════════
// COLLECTION / STOREFRONT INSTANT EXPERIENCE
// ══════════════════════════════════════════════════════════════════
// Derived from two known-good Collection ads on a live client account.
// The canonical link_data shape (minus per-ad copy) is:
//
//   object_story_spec.link_data = {
//     link: "https://fb.com/canvas_doc/{canvas_id}",  // IE landing
//     message, name, description,                      // ad copy
//     image_hash: "<cover ad-image hash>",             // cover lives HERE,
//                                                      // not in the canvas
//     call_to_action: { type: "SHOP_NOW" },            // no value.link
//     retailer_item_ids: ["0","0","0","0"],            // 4 placeholders —
//                                                      // flags the ad as
//                                                      // Collection and
//                                                      // reserves the four
//                                                      // product tiles
//   }
//
// Flow:
//   1. Upload cover via `act_{id}/adimages` (account scope → user token,
//      no page permissions required) → returns an image hash.
//   2. Create a canvas with product_set + CTA button (cover is NOT a
//      canvas element — it's on link_data). Canvas creation uses page
//      token via meta-proxy's pageId swap.
//   3. Return a link_data creative wired to the canvas URL, with the
//      image_hash and retailer_item_ids that mark it as Collection.

// Standard Collection grid shows 4 product tiles; "0" tells Meta to
// auto-fill from the product set the canvas is bound to.
const COLLECTION_RETAILER_ITEM_PLACEHOLDERS = ['0', '0', '0', '0'];

async function uploadAdImage(accountId: string, imageUrl: string): Promise<string> {
  // POST /act_{id}/adimages — Meta rejects the `url` param for non-Meta apps
  // (#3 app capability). Multipart file upload is the only third-party path.
  // meta-proxy fetches the Cloudinary URL server-side and forwards the bytes.
  // Response shape: { images: { <filename>: { hash, url, width, height } } }.
  // Uses the user/system-user token (ads_management scope) — no page perms.
  const res = await metaPost(
    accountId,
    `act_${accountId}/adimages`,
    {},
    { multipart: { fileUrl: imageUrl } },
  );
  if (res.error) throw new Error(`Ad image upload failed: ${res.error.error_user_msg || res.error.message}`);
  const images = (res.images || {}) as Record<string, { hash?: string }>;
  const firstHash = Object.values(images)[0]?.hash;
  if (!firstHash) throw new Error('No image hash returned from Meta adimages');
  return firstHash;
}

async function createCanvasElement(
  accountId: string,
  pageId: string,
  body: Record<string, unknown>,
): Promise<string> {
  const res = await metaPost(accountId, `${pageId}/canvas_elements`, body, { pageId });
  if (res.error) throw new Error(`Canvas element creation failed: ${res.error.error_user_msg || res.error.message}`);
  if (!res.id) throw new Error('No canvas element ID returned from Meta');
  return res.id;
}

async function buildCollectionStorefront(
  ad: AdInput,
  ctx: CreativeCtx,
  accountId: string,
): Promise<Record<string, unknown>> {
  if (!ctx.pageId) throw new Error('Collection ads require a Facebook Page on the ad account');
  if (!ad.collection_product_set_id) throw new Error('Collection ad missing product_set_id');
  if (!ad.collection_button_label?.trim()) throw new Error('Collection ad missing button label');

  const buttonUrl = (ad.collection_button_url || ad.url || '').trim();
  if (!buttonUrl) throw new Error('Collection ad missing destination URL for the fixed button');

  const coverKind = ad.collection_cover_kind === 'VIDEO' ? 'VIDEO' : 'IMAGE';
  const headline = (ad.headlines || [])[0] || '';
  const primaryText = (ad.primary_texts || [])[0] || '';
  const ctaType = ad.call_to_action || 'SHOP_NOW';

  // ── Step 1: resolve cover media ──
  // Both cover kinds end up uploading an image to /adimages (either the
  // cover itself for IMAGE, or the video poster for VIDEO) and stuffing
  // the returned hash into the creative.
  let coverImageHash: string;
  let coverVideoId: string | null = null;
  if (coverKind === 'VIDEO') {
    if (!ad.video_url) throw new Error('Collection video cover requires a video URL');
    const { videoId, thumbnailUrl: metaThumb } = await uploadVideoToMeta(
      accountId,
      ad.video_url,
      ad.video_file_name || ad.name,
    );
    coverVideoId = videoId;
    // Prefer a user-provided thumbnail (HTTPS URL); fall back to the
    // auto-generated frame Meta returned from /advideos. The poster is
    // required — Collection video ads reject missing image_hash.
    const posterUrl = (ad.thumbnail_url && String(ad.thumbnail_url).startsWith('https://'))
      ? ad.thumbnail_url
      : metaThumb;
    if (!posterUrl) {
      throw new Error('Collection video cover needs a poster — Meta did not return a thumbnail and none was provided');
    }
    coverImageHash = await uploadAdImage(accountId, posterUrl);
  } else {
    if (!ad.square_image_url) throw new Error('Collection image cover requires a square image URL');
    coverImageHash = await uploadAdImage(accountId, ad.square_image_url);
  }

  // ── Step 2: canvas elements — product grid + CTA button ──
  const productSetElementId = await createCanvasElement(accountId, ctx.pageId, {
    canvas_product_set: { product_set_id: ad.collection_product_set_id },
  });
  const buttonElementId = await createCanvasElement(accountId, ctx.pageId, {
    canvas_button: {
      rich_text: { plain_text: ad.collection_button_label.trim() },
      open_url_action: { url: buttonUrl },
    },
  });

  // ── Step 3: canvas ──
  const canvasRes = await metaPost(accountId, `${ctx.pageId}/canvases`, {
    name: `${ad.name} — Storefront`,
    body_element_ids: [productSetElementId, buttonElementId],
    is_published: true,
  }, { pageId: ctx.pageId });
  if (canvasRes.error) throw new Error(`Canvas creation failed: ${canvasRes.error.error_user_msg || canvasRes.error.message}`);
  const canvasId = canvasRes.id;
  if (!canvasId) throw new Error('No canvas ID returned from Meta');

  console.log(`[Collection] ${ad.name} → kind: ${coverKind}, canvas_id: ${canvasId}, image_hash: ${coverImageHash}${coverVideoId ? `, video_id: ${coverVideoId}` : ''}, product_set: ${productSetElementId}, button: ${buttonElementId}`);

  // ── Step 4: ad creative ──
  // Image cover → link_data with `link` at top level.
  // Video cover → video_data; the canvas link moves INSIDE call_to_action.value.link.
  const canvasUrl = `https://fb.com/canvas_doc/${canvasId}`;

  if (coverKind === 'VIDEO') {
    const videoData: Record<string, unknown> = {
      video_id: coverVideoId,
      message: primaryText,
      image_hash: coverImageHash,
      retailer_item_ids: COLLECTION_RETAILER_ITEM_PLACEHOLDERS,
      call_to_action: { type: ctaType, value: { link: canvasUrl } },
    };
    if (headline) videoData.title = headline;

    return {
      object_story_spec: {
        page_id: ctx.pageId,
        ...(ctx.instagramId ? { instagram_user_id: ctx.instagramId } : {}),
        video_data: videoData,
      },
    };
  }

  const linkData: Record<string, unknown> = {
    link: canvasUrl,
    message: primaryText,
    image_hash: coverImageHash,
    call_to_action: { type: ctaType },
    retailer_item_ids: COLLECTION_RETAILER_ITEM_PLACEHOLDERS,
  };
  if (headline) linkData.name = headline;

  return {
    object_story_spec: {
      page_id: ctx.pageId,
      ...(ctx.instagramId ? { instagram_user_id: ctx.instagramId } : {}),
      link_data: linkData,
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// 5. UPLOAD VIDEO TO META — returns video_id
// ══════════════════════════════════════════════════════════════════
interface VideoUploadResult {
  videoId: string;
  thumbnailUrl: string | null;
}

async function uploadVideoToMeta(accountId: string, videoUrl: string, name?: string): Promise<VideoUploadResult> {
  const res = await metaPost(accountId, `act_${accountId}/advideos`, {
    name: name?.trim() || 'API created Video Media',
    file_url: videoUrl,
  });
  if (res.error) throw new Error(`Video upload failed: ${res.error.error_user_msg || res.error.message}`);
  if (!res.id) throw new Error('No video ID returned from Meta');

  // Poll until video is ready (Meta needs time to process)
  const videoId = res.id;
  const maxAttempts = 20;
  const pollInterval = 3000; // 3 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    try {
      const statusRes = await metaGet(accountId, `${videoId}?fields=status`);
      const videoStatus = statusRes.status?.video_status;
      console.log(`[Video Status] ${videoId}: ${videoStatus} (attempt ${attempt + 1}/${maxAttempts})`);

      if (videoStatus === 'ready') {
        // Fetch auto-generated thumbnail
        let thumbnailUrl: string | null = null;
        try {
          const thumbRes = await metaGet(accountId, `${videoId}/thumbnails`);
          const thumbs = (thumbRes as { data?: Array<{ uri?: string }> }).data;
          if (thumbs?.[0]?.uri) thumbnailUrl = thumbs[0].uri;
          console.log(`[Video Thumbnail] ${videoId}: ${thumbnailUrl ? 'fetched' : 'none available'}`);
        } catch { /* non-fatal — thumbnail is optional fallback */ }
        return { videoId, thumbnailUrl };
      }
      if (videoStatus === 'error') throw new Error('Video processing failed on Meta');
    } catch (err) {
      // If the status check fails, the video might still be processing — continue polling
      if ((err as Error).message === 'Video processing failed on Meta') throw err;
      console.warn(`[Video Status] Poll attempt ${attempt + 1} failed, retrying...`);
    }
  }

  // If we've waited ~60 seconds and still not ready, proceed anyway — Meta might accept it
  console.warn(`[Video Status] ${videoId}: Timed out waiting for ready status, proceeding anyway`);
  return { videoId, thumbnailUrl: null };
}

// ══════════════════════════════════════════════════════════════════
// 6. SIMPLE VIDEO — object_story_spec with video_data
//    Used when: SINGLE_VIDEO + single text
// ══════════════════════════════════════════════════════════════════
function buildSimpleVideoCreative(ad: AdInput, ctx: CreativeCtx, videoId: string): Record<string, unknown> {
  const isLeadAd = ctx.adSetConvLoc === 'On Ad' && ad.lead_form_id;
  const headlines = ad.headlines || [];
  const primaryTexts = ad.primary_texts || [];

  const ctaValue: Record<string, unknown> = isLeadAd
    ? { link: 'http://fb.me/', lead_gen_form_id: ad.lead_form_id }
    : { link: ad.url || '' };

  const videoData: Record<string, unknown> = {
    message: primaryTexts[0] || '',
    title: headlines[0] || '',
    video_id: videoId,
    ...(ad.thumbnail_url ? { image_url: ad.thumbnail_url } : {}),
    call_to_action: {
      type: ad.call_to_action || (isLeadAd ? 'SIGN_UP' : 'SHOP_NOW'),
      value: ctaValue,
    },
  };

  if (ad.descriptions?.[0]) videoData.link_description = ad.descriptions[0];

  return {
    object_story_spec: {
      page_id: ctx.pageId,
      ...(ctx.instagramId ? { instagram_user_id: ctx.instagramId } : {}),
      video_data: videoData,
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// 7. ASSET FEED VIDEO — asset_feed_spec with videos
//    Used when: SINGLE_VIDEO + multiple texts (multi-variant)
// ══════════════════════════════════════════════════════════════════
function buildAssetFeedVideoCreative(
  ad: AdInput,
  ctx: CreativeCtx,
  videoId: string,
  storyVideoId: string | null = null,
): Record<string, unknown> {
  const isLeadAd = ctx.adSetConvLoc === 'On Ad' && ad.lead_form_id;
  const headlines = ad.headlines || [];
  const primaryTexts = ad.primary_texts || [];
  const hasStoryVideo = !!storyVideoId;

  // ── Videos ──
  // Without a story variant: same feed video labeled for both fb + ig.
  // With a story variant: 4 labels (fb-feed, fb-story, ig-feed, ig-story),
  //   feed positions use the 1:1/16:9 clip, story/reels use the 9:16 clip.
  const videos: Array<Record<string, unknown>> = hasStoryVideo
    ? [
        { video_id: videoId, adlabels: [{ name: 'video_fb_feed' }], thumbnail_url: ad.thumbnail_url || undefined },
        { video_id: videoId, adlabels: [{ name: 'video_ig_feed' }], thumbnail_url: ad.thumbnail_url || undefined },
        { video_id: storyVideoId!, adlabels: [{ name: 'video_fb_story' }], thumbnail_url: ad.story_thumbnail_url || undefined },
        { video_id: storyVideoId!, adlabels: [{ name: 'video_ig_story' }], thumbnail_url: ad.story_thumbnail_url || undefined },
      ]
    : [
        { video_id: videoId, adlabels: [{ name: 'labelfb' }], thumbnail_url: ad.thumbnail_url || undefined },
        { video_id: videoId, adlabels: [{ name: 'labelig' }], thumbnail_url: ad.thumbnail_url || undefined },
      ];

  // ── Titles — all variants share same label so every rule uses ALL of them ──
  const titles = headlines.map((h: string) => ({
    text: h,
    adlabels: [{ name: 'title_var_1' }],
  }));

  // ── Bodies — all variants share same label ──
  const bodies = primaryTexts.map((t: string) => ({
    text: t,
    adlabels: [{ name: 'body_var_1' }],
  }));

  const customizationRules = hasStoryVideo
    ? [
        {
          video_label: { name: 'video_fb_feed' },
          title_label: { name: 'title_var_1' },
          body_label: { name: 'body_var_1' },
          customization_spec: {
            publisher_platforms: ['facebook'],
            facebook_positions: ['feed'],
          },
        },
        {
          video_label: { name: 'video_fb_story' },
          title_label: { name: 'title_var_1' },
          body_label: { name: 'body_var_1' },
          customization_spec: {
            publisher_platforms: ['facebook'],
            facebook_positions: ['story', 'facebook_reels'],
          },
        },
        {
          video_label: { name: 'video_ig_feed' },
          title_label: { name: 'title_var_1' },
          body_label: { name: 'body_var_1' },
          customization_spec: {
            publisher_platforms: ['instagram'],
            instagram_positions: ['stream', 'explore', 'explore_home'],
          },
        },
        {
          video_label: { name: 'video_ig_story' },
          title_label: { name: 'title_var_1' },
          body_label: { name: 'body_var_1' },
          customization_spec: {
            publisher_platforms: ['instagram'],
            instagram_positions: ['story', 'reels'],
          },
        },
      ]
    : [
        {
          video_label: { name: 'labelfb' },
          title_label: { name: 'title_var_1' },
          body_label: { name: 'body_var_1' },
          customization_spec: {
            publisher_platforms: ['facebook'],
            facebook_positions: ['feed', 'story', 'facebook_reels'],
          },
        },
        {
          video_label: { name: 'labelig' },
          title_label: { name: 'title_var_1' },
          body_label: { name: 'body_var_1' },
          customization_spec: {
            publisher_platforms: ['instagram'],
            instagram_positions: ['stream', 'explore', 'explore_home', 'story', 'reels'],
          },
        },
      ];

  // ── Asset feed spec ──
  const assetFeedSpec: Record<string, unknown> = {
    ad_formats: ['SINGLE_VIDEO'],
    videos,
    titles,
    bodies,
    descriptions: [{ text: ' ' }],
    call_to_action_types: [ad.call_to_action || (isLeadAd ? 'SIGN_UP' : 'SHOP_NOW')],
    link_urls: [{ website_url: isLeadAd ? 'http://fb.me/' : (ad.url || '') }],
    asset_customization_rules: customizationRules,
    optimization_type: 'PLACEMENT',
  };

  const spec: Record<string, unknown> = {
    object_story_spec: {
      page_id: ctx.pageId,
      ...(ctx.instagramId ? { instagram_user_id: ctx.instagramId } : {}),
    },
    asset_feed_spec: assetFeedSpec,
  };

  // ── Lead ads ──
  if (isLeadAd) {
    (spec.asset_feed_spec as Record<string, unknown>).call_to_actions = [{
      type: ad.call_to_action || 'SIGN_UP',
      value: { lead_gen_form_id: ad.lead_form_id, link: 'http://fb.me/' },
    }];
  }

  return spec;
}

// ══════════════════════════════════════════════════════════════════
// Main orchestrator
// ══════════════════════════════════════════════════════════════════

export interface LaunchResult {
  meta_campaign_id?: string;
  campaign_id?: string;
  ad_sets: Array<{
    name: string;
    status: string;
    error?: string;
    meta_adset_id?: string;
    db_adset_id?: string;
    ads: Array<{
      name: string;
      status: string;
      error?: string;
      meta_ad_id?: string;
    }>;
  }>;
}

export interface LaunchProgress {
  /** Human-readable status for the current operation. */
  message: string;
  /** Number of macro steps completed so far (campaign + ad sets + ads). */
  completed: number;
  /** Total macro steps for this launch. */
  total: number;
}

export type LaunchProgressCallback = (progress: LaunchProgress) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function launchCampaign(
  payload: Record<string, any>,
  onProgress?: LaunchProgressCallback,
): Promise<LaunchResult> {
  const {
    account_id,
    organization_id,
    campaign,
    campaign_type,
    existing_campaign_id,
    ad_sets,
    page_id,
    pixel_id,
    instagram_id,
  } = payload;

  // Look up the DB UUID for the ad account (needed for FK)
  const { data: adAccountRow } = await supabase
    .from('AdAccounts')
    .select('id')
    .eq('platformAccountId', account_id)
    .limit(1)
    .single();
  const adAccountDbId = adAccountRow?.id;

  // Look up the Client record (other team's table, required FK for Campaign)
  const { data: clientRow } = await supabase
    .from('Client')
    .select('id')
    .eq('platformAccountId', account_id)
    .limit(1)
    .single();
  const clientDbId = clientRow?.id;

  const results: LaunchResult = { ad_sets: [] };

  // Progress tracking: one step per macro op (campaign + each ad set + each ad).
  // When campaign is "existing" we skip the campaign step but still report
  // progress so the UI stays consistent.
  const totalAds = (ad_sets || []).reduce(
    (sum: number, s: { ads?: unknown[] }) => sum + (s.ads?.length || 0),
    0,
  );
  const totalSteps = (campaign_type === 'existing' ? 0 : 1) + (ad_sets?.length || 0) + totalAds;
  let completedSteps = 0;
  const report = (message: string) => {
    onProgress?.({ message, completed: completedSteps, total: totalSteps });
  };

  // ── Step 1: Create or use existing campaign ──
  let metaCampaignId: string;

  if (campaign_type === 'existing' && existing_campaign_id) {
    metaCampaignId = existing_campaign_id;
    results.meta_campaign_id = metaCampaignId;
  } else {
    report(`Creating campaign "${campaign.name}"…`);
    const specialCats = campaign.special_ad_categories || [];
    const metaSpecialCats = specialCats.length === 0 || (specialCats.length === 1 && specialCats[0] === 'NONE')
      ? ['NONE']
      : specialCats.filter((c: string) => c !== 'NONE');

    const campaignParams: Record<string, unknown> = {
      name: campaign.name,
      objective: campaign.objective,
      status: 'PAUSED',
      special_ad_categories: metaSpecialCats,
    };

    if (campaign.buying_type) campaignParams.buying_type = campaign.buying_type;

    if (campaign.advantage_plus_catalog && campaign.catalog_id) {
      campaignParams.promoted_object = { product_catalog_id: campaign.catalog_id };
    }

    if (campaign.advantage_campaign_budget) {
      if (campaign.campaign_budget_type === 'Daily' && campaign.campaign_budget_value) {
        campaignParams.daily_budget = Math.round(campaign.campaign_budget_value * 100);
      } else if (campaign.campaign_budget_type === 'Lifetime' && campaign.campaign_budget_value) {
        campaignParams.lifetime_budget = Math.round(campaign.campaign_budget_value * 100);
      }
      if (campaign.bid_strategy) campaignParams.bid_strategy = campaign.bid_strategy;
      if (campaign.bid_amount && (campaign.bid_strategy === 'LOWEST_COST_WITH_BID_CAP' || campaign.bid_strategy === 'COST_CAP')) {
        campaignParams.bid_amount = Math.round(campaign.bid_amount * 100);
      }
    }

    const campaignRes = await metaPost(account_id, `act_${account_id}/campaigns`, campaignParams);

    if (campaignRes.error) {
      throw new Error(`Campaign creation failed: ${campaignRes.error.error_user_msg || campaignRes.error.message}`);
    }

    metaCampaignId = campaignRes.id;
    results.meta_campaign_id = metaCampaignId;

    // Save to Supabase
    if (adAccountDbId && clientDbId) {
      const { data: dbCampaign } = await supabase.from('Campaign').insert({
        id: crypto.randomUUID(),
        tenantId: organization_id,
        clientId: clientDbId,
        adAccountId: adAccountDbId,
        campaignId: metaCampaignId,
        campaignName: campaign.name,
        objective: campaign.objective,
        buyingType: campaign.buying_type || 'AUCTION',
        bidStrategy: campaign.bid_strategy || null,
        advantageCampaignBudget: campaign.advantage_campaign_budget || false,
        campaignBudgetType: campaign.campaign_budget_type || null,
        campaignBudgetValue: campaign.campaign_budget_value || null,
        specialAdCategories: campaign.special_ad_categories || [],
        status: 'CREATED',
        metaStatus: 'PAUSED',
      }).select('id').single();
      if (dbCampaign) results.campaign_id = dbCampaign.id;
    }
    completedSteps += 1;
  }

  // ── Step 2: Create ad sets + ads ──
  for (const adSetInput of ad_sets || []) {
    const adSetResult: LaunchResult['ad_sets'][0] = {
      name: adSetInput.name,
      status: 'PENDING',
      ads: [],
    };

    let metaAdsetId: string;
    const tf = adSetInput.template_fields || {};
    const convLoc = tf.adsetConversionLocation || tf.adset_conversion_location || '';
    report(`Creating ad set "${adSetInput.name}"…`);

    if (adSetInput.type === 'existing' && adSetInput.existing_adset_id) {
      metaAdsetId = adSetInput.existing_adset_id;
      adSetResult.meta_adset_id = metaAdsetId;
      adSetResult.status = 'EXISTING';
    } else {
      const objective = campaign?.objective || 'OUTCOME_SALES';
      const optimizationGoal = deriveOptimizationGoal(objective, convLoc, tf.optimization);
      const promotedObject = derivePromotedObject(objective, convLoc, tf.pixelId || tf.pixel_id || pixel_id, page_id);

      const targeting = buildTargetingSpec(
        tf.placements || 'Automatic',
        tf.placementOptions || tf.placement_options || null,
        { targetGender: tf.targetGender || tf.target_gender, targetAge: tf.targetAge || tf.target_age, location: tf.location }
      );

      const adsetParams: Record<string, unknown> = {
        campaign_id: metaCampaignId,
        name: adSetInput.name,
        optimization_goal: optimizationGoal,
        billing_event: 'IMPRESSIONS',
        status: 'PAUSED',
        targeting,
      };

      if (promotedObject) adsetParams.promoted_object = promotedObject;

      // Budget & bid strategy
      if (!campaign?.advantage_campaign_budget) {
        // CBO OFF — budget + bid at ad set level
        const bidStrategy = tf.bidStrategy || tf.bid_strategy;
        if (bidStrategy) adsetParams.bid_strategy = bidStrategy;
        const bidAmount = tf.bidAmount || tf.bid_amount;
        if (bidAmount && (bidStrategy === 'LOWEST_COST_WITH_BID_CAP' || bidStrategy === 'COST_CAP')) {
          adsetParams.bid_amount = Math.round(bidAmount * 100);
        }
        const budgetType = tf.adsetBudgetType || tf.adset_budget_type || 'Daily';
        const budgetValue = tf.adsetBudgetValue || tf.adset_budget_value;
        if (budgetValue) {
          if (budgetType === 'Daily') adsetParams.daily_budget = Math.round(budgetValue * 100);
          else adsetParams.lifetime_budget = Math.round(budgetValue * 100);
        }
      } else {
        // CBO ON — bid_amount still required at ad set level for Cost Cap / Bid Cap
        const campaignBidStrategy = campaign.bid_strategy;
        const campaignBidAmount = campaign.bid_amount;
        if (campaignBidAmount && (campaignBidStrategy === 'LOWEST_COST_WITH_BID_CAP' || campaignBidStrategy === 'COST_CAP')) {
          adsetParams.bid_amount = Math.round(campaignBidAmount * 100);
        }
      }

      // Attribution spec
      if (optimizationGoal === 'OFFSITE_CONVERSIONS' && (tf.attributionSetting || tf.attribution_setting)) {
        adsetParams.attribution_spec = parseAttributionSetting(tf.attributionSetting || tf.attribution_setting);
      }

      // Dynamic creative logic:
      // 1. If multi-variant (story variants) → use asset_feed_spec with placement optimization.
      //    is_dynamic_creative must NOT be set (conflicts with asset_customization_rules).
      // 2. If no story variants but multiple texts → auto-enable is_dynamic_creative
      //    so Meta can rotate text variants.
      // 3. If explicitly set in template and no story variants → respect the template setting.
      const hasAnyStoryVariant = (adSetInput.ads || []).some(
        (ad: AdInput) => !!ad.story_image_url || (ad.carousel_cards || []).some((c: AdInput) => !!c.story_image_url)
      );
      // Dynamic creative: only set when explicitly enabled in template
      // Multi-text without dynamic creative uses asset_feed_spec with optimization_type: PLACEMENT
      const wantsDynamicCreative = !!(tf.dynamicCreative || tf.dynamic_creative);
      const useDynamicCreative = wantsDynamicCreative && !hasAnyStoryVariant;

      if (useDynamicCreative) {
        adsetParams.is_dynamic_creative = true;
      }
      // When story variants exist, we skip is_dynamic_creative entirely
      // — asset_feed_spec with optimization_type: PLACEMENT handles multi-text via shared adlabels
      if (tf.startDate || tf.start_date) adsetParams.start_time = tf.startDate || tf.start_date;
      if ((tf.setEndDate || tf.set_end_date) && (tf.endDate || tf.end_date)) {
        adsetParams.end_time = tf.endDate || tf.end_date;
      }
      if (convLoc === 'On Ad') adsetParams.destination_type = 'ON_AD';
      if (page_id) {
        adsetParams.dsa_beneficiary = page_id;
        adsetParams.dsa_payor = page_id;
      }

      console.log('[Campaign] Ad set params:', adSetInput.name, '— is_dynamic_creative:', adsetParams.is_dynamic_creative, '— tf.dynamicCreative:', tf.dynamicCreative);

      try {
        const adsetRes = await metaPost(account_id, `act_${account_id}/adsets`, adsetParams);

        metaAdsetId = adsetRes.id;
        adSetResult.meta_adset_id = metaAdsetId;
        adSetResult.status = 'CREATED';

        // Save to Supabase
        if (results.campaign_id) {
          const { data: dbAdSet } = await supabase.from('AdSet').insert({
            id: crypto.randomUUID(),
            campaignId: results.campaign_id,
            adSetId: metaAdsetId,
            adSetName: adSetInput.name,
            optimizationGoal: optimizationGoal,
            conversionLocation: convLoc || null,
            bidStrategy: tf.bidStrategy || tf.bid_strategy || null,
            budgetType: tf.adsetBudgetType || tf.adset_budget_type || null,
            budgetValue: tf.adsetBudgetValue || tf.adset_budget_value || null,
            placements: tf.placements || 'Automatic',
            placementOptions: tf.placementOptions || tf.placement_options || {},
            pixelId: tf.pixelId || tf.pixel_id || pixel_id || null,
            status: 'CREATED',
            metaStatus: 'PAUSED',
          }).select('id').single();
          if (dbAdSet) adSetResult.db_adset_id = dbAdSet.id;
        }
      } catch (err) {
        adSetResult.status = 'FAILED';
        adSetResult.error = (err as Error).message;
        results.ad_sets.push(adSetResult);
        // Still consume the step budget for this ad set + its ads so the
        // progress bar doesn't stall at a never-reached total.
        completedSteps += 1 + (adSetInput.ads?.length || 0);
        report(`Ad set "${adSetInput.name}" failed — continuing`);
        continue;
      }
    }
    completedSteps += 1;

    // ── Step 3: Create ads ──
    const adInputs: AdInput[] = adSetInput.ads || [];
    for (let adIdx = 0; adIdx < adInputs.length; adIdx++) {
      const adInput = adInputs[adIdx];
      const adLabel = `${adInput.name} (${adIdx + 1}/${adInputs.length})`;
      const adResult: LaunchResult['ad_sets'][0]['ads'][0] = {
        name: adInput.name,
        status: 'PENDING',
      };

      let adParams: Record<string, unknown> = {};
      try {
        const headlines = adInput.headlines || [];
        const primaryTexts = adInput.primary_texts || [];
        const creativeType = adInput.creative_type || 'SINGLE_IMAGE';
        const isCollection = creativeType === 'COLLECTION';
        const isVideo = creativeType === 'SINGLE_VIDEO' && !!adInput.video_url;
        const hasStory = !!adInput.story_image_url;
        const isCarousel = creativeType === 'CAROUSEL' && adInput.carousel_cards?.length > 0;
        const isMultiVariant = headlines.length > 1 || primaryTexts.length > 1;
        const needsAssetFeed = isMultiVariant || hasStory;

        const ctx: CreativeCtx = { pageId: page_id || '', instagramId: instagram_id || null, adSetConvLoc: convLoc };

        // ── Dispatch to the right creative builder ──
        let creativeSpec: Record<string, unknown>;

        if (isCollection) {
          report(`Building Storefront for ${adLabel}…`);
          creativeSpec = await buildCollectionStorefront(adInput, ctx, account_id);
        } else if (isVideo) {
          report(`Uploading video for ${adLabel}…`);
          // Upload the feed video. When the ad carries a 9:16 story video
          // variant, upload that in parallel and pass both ids to the builder
          // so asset_customization_rules can route feed vs story placements.
          const hasStoryVideo = !!adInput.story_video_url;
          // Use original filename for Meta media library naming. Fall back to
          // ad name when filename isn't available (e.g. URL-pasted videos).
          const feedName = adInput.video_file_name || adInput.name;
          const storyName = adInput.story_video_file_name || adInput.name;
          const [feedResult, storyResult] = await Promise.all([
            uploadVideoToMeta(account_id, adInput.video_url, feedName),
            hasStoryVideo
              ? uploadVideoToMeta(account_id, adInput.story_video_url, storyName)
              : Promise.resolve<VideoUploadResult | null>(null),
          ]);
          const videoId = feedResult.videoId;
          const storyVideoId = storyResult?.videoId ?? null;
          // Use user-provided thumbnail; fall back to Meta's auto-generated one.
          if (!adInput.thumbnail_url && feedResult.thumbnailUrl) {
            adInput.thumbnail_url = feedResult.thumbnailUrl;
          }
          if (!adInput.story_thumbnail_url && storyResult?.thumbnailUrl) {
            adInput.story_thumbnail_url = storyResult.thumbnailUrl;
          }
          console.log(`[Video Upload] ${adInput.name} → feed video_id: ${videoId}${storyVideoId ? `, story video_id: ${storyVideoId}` : ''}`);

          if (needsAssetFeed) {
            creativeSpec = buildAssetFeedVideoCreative(adInput, ctx, videoId, storyVideoId);
          } else {
            creativeSpec = buildSimpleVideoCreative(adInput, ctx, videoId);
          }
        } else if (isCarousel) {
          const carouselHasStory = (adInput.carousel_cards || []).some(
            (c: AdInput) => !!c.story_image_url
          );
          if (carouselHasStory || needsAssetFeed) {
            creativeSpec = buildAssetFeedCarouselCreative(adInput, ctx);
          } else {
            creativeSpec = buildSimpleCarouselCreative(adInput, ctx);
          }
        } else if (hasStory || needsAssetFeed) {
          creativeSpec = buildAssetFeedImageCreative(adInput, ctx);
        } else {
          creativeSpec = buildSimpleImageCreative(adInput, ctx);
        }

        // Advantage+ creative — inject degrees_of_freedom_spec into every
        // creative shape (simple + asset_feed). Individual builders used to
        // handle this but only the asset_feed builders did; centralising here
        // guarantees the DOF spec is always present when the user picked a
        // template, regardless of creative shape.
        if (adInput.advantage_creative_config) {
          creativeSpec.degrees_of_freedom_spec = {
            creative_features_spec: adInput.advantage_creative_config,
          };
        }

        // Product extensions (sidecar "Show Products") — when the user
        // picks a product set for an ad, keep the original creative intact
        // and attach the catalog/product set via creative_sourcing_spec.
        // Meta overlays catalog products alongside the main media in
        // supported placements. This replaces the old template_data approach
        // which was replacing the whole creative with a DPA render.
        // Skipped for COLLECTION ads — they already reference a product
        // set via the Instant Experience canvas and Meta rejects the combo.
        if (adInput.product_set_id && !isCollection) {
          creativeSpec.creative_sourcing_spec = {
            associated_product_set_id: adInput.product_set_id,
          };
          // Force product_extensions ON with MANUAL action metadata so Meta
          // knows the product set was user-selected (not auto-suggested).
          const dofSpec = (creativeSpec.degrees_of_freedom_spec || {}) as Record<string, unknown>;
          const features = (dofSpec.creative_features_spec || {}) as Record<string, unknown>;
          features.product_extensions = {
            enroll_status: 'OPT_IN',
            action_metadata: { type: 'MANUAL' },
          };
          dofSpec.creative_features_spec = features;
          creativeSpec.degrees_of_freedom_spec = dofSpec;
        }

        // Music — inject audios into asset_feed_spec when enabled.
        // Only works on asset_feed_spec creatives; simple creatives are skipped.
        if (adInput.enable_music && creativeSpec.asset_feed_spec) {
          (creativeSpec.asset_feed_spec as Record<string, unknown>).audios = [{ type: 'random' }];
        }

        // Create ad with inline creative (single POST to ads endpoint)
        adParams = {
          name: adInput.name,
          adset_id: metaAdsetId,
          status: 'PAUSED',
          creative: creativeSpec,
        };

        if (adInput.url_parameters) adParams.url_tags = adInput.url_parameters;

        // Per-ad delivery schedule (Meta's ad_schedule_*_time). Only included
        // when the user actually picked dates — otherwise Meta treats the ad
        // as always-on within the ad set window.
        if (adInput.ad_schedule_start_time) adParams.ad_schedule_start_time = adInput.ad_schedule_start_time;
        if (adInput.ad_schedule_end_time) adParams.ad_schedule_end_time = adInput.ad_schedule_end_time;

        // Tracking specs for pixel
        const effectivePixelId = tf.pixelId || tf.pixel_id || pixel_id;
        if (effectivePixelId) {
          adParams.tracking_specs = [
            { 'action.type': ['offsite_conversion'], fb_pixel: [effectivePixelId] },
          ];
        }

        report(`Creating ${adLabel}…`);
        const adRes = await metaPost(account_id, `act_${account_id}/ads`, adParams);

        adResult.meta_ad_id = adRes.id;
        adResult.status = 'CREATED';

        // Save to Supabase
        if (adSetResult.db_adset_id) {
          await supabase.from('Ad').insert({
            id: crypto.randomUUID(),
            adSetId: adSetResult.db_adset_id,
            adId: adRes.id,
            adName: adInput.name,
            adCopies: primaryTexts,
            titles: headlines,
            url: adInput.url || null,
            callToAction: adInput.call_to_action || null,
            urlParameters: adInput.url_parameters || null,
            squareImageUrl: adInput.square_image_url || null,
            storyImageUrl: adInput.story_image_url || null,
            advantageCreativeConfig: adInput.advantage_creative_config || null,
            carouselCards: creativeType === 'CAROUSEL' ? (adInput.carousel_cards || []) : [],
            status: 'CREATED',
            metaStatus: 'PAUSED',
          });
        }
      } catch (err) {
        adResult.status = 'FAILED';
        adResult.error = (err as Error).message;
        logAdError({
          source: 'campaign-builder',
          adName: adInput.name || 'Unknown Ad',
          errorMessage: (err as Error).message,
          requestBody: adParams,
          extra: { adset_id: metaAdsetId, campaign_id: metaCampaignId },
        });
      }

      completedSteps += 1;
      adSetResult.ads.push(adResult);
    }

    results.ad_sets.push(adSetResult);
  }

  report('Wrapping up…');

  return results;
}
