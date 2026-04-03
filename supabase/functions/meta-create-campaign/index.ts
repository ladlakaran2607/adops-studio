import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  getUser,
  getAccessToken,
  createServiceClient,
  metaUrl,
  logError,
} from "../_shared/supabase.ts";

// ── Placement mapping: frontend booleans → Meta publisher_platforms + positions ──

const PLACEMENT_MAP: Record<string, { platform: string; position: string }> = {
  facebookFeed: { platform: "facebook", position: "feed" },
  facebookProfileFeed: { platform: "facebook", position: "profile_feed" },
  facebookStories: { platform: "facebook", position: "story" },
  facebookMarketplace: { platform: "facebook", position: "marketplace" },
  facebookVideoFeeds: { platform: "facebook", position: "video_feeds" },
  facebookRightColumn: { platform: "facebook", position: "right_hand_column" },
  facebookReels: { platform: "facebook", position: "facebook_reels" },
  facebookInStreamVideos: { platform: "facebook", position: "instream_video" },
  adsOnFacebookReels: { platform: "facebook", position: "facebook_reels_overlay" },
  facebookSearchResults: { platform: "facebook", position: "search" },
  instagramFeed: { platform: "instagram", position: "stream" },
  instagramProfileFeed: { platform: "instagram", position: "profile_feed" },
  instagramExplore: { platform: "instagram", position: "explore" },
  instagramExploreHome: { platform: "instagram", position: "explore_home" },
  instagramStories: { platform: "instagram", position: "story" },
  instagramReels: { platform: "instagram", position: "reels" },
  instagramSearchResults: { platform: "instagram", position: "ig_search" },
  messengerHome: { platform: "messenger", position: "messenger_home" },
  messengerSponsoredMessages: { platform: "messenger", position: "sponsored_messages" },
  audienceNetworkClassic: { platform: "audience_network", position: "classic" },
  audienceNetworkRewarded: { platform: "audience_network", position: "rewarded_video" },
};

// ── Country name → ISO 3166-1 alpha-2 code mapping ──
const COUNTRY_MAP: Record<string, string> = {
  "afghanistan": "AF", "albania": "AL", "algeria": "DZ", "argentina": "AR",
  "australia": "AU", "austria": "AT", "bangladesh": "BD", "belgium": "BE",
  "brazil": "BR", "bulgaria": "BG", "canada": "CA", "chile": "CL",
  "china": "CN", "colombia": "CO", "croatia": "HR", "czech republic": "CZ",
  "czechia": "CZ", "denmark": "DK", "egypt": "EG", "estonia": "EE",
  "finland": "FI", "france": "FR", "germany": "DE", "greece": "GR",
  "hong kong": "HK", "hungary": "HU", "india": "IN", "indonesia": "ID",
  "ireland": "IE", "israel": "IL", "italy": "IT", "japan": "JP",
  "kenya": "KE", "latvia": "LV", "lithuania": "LT", "luxembourg": "LU",
  "malaysia": "MY", "mexico": "MX", "morocco": "MA", "netherlands": "NL",
  "new zealand": "NZ", "nigeria": "NG", "norway": "NO", "pakistan": "PK",
  "peru": "PE", "philippines": "PH", "poland": "PL", "portugal": "PT",
  "romania": "RO", "russia": "RU", "saudi arabia": "SA", "singapore": "SG",
  "slovakia": "SK", "slovenia": "SI", "south africa": "ZA", "south korea": "KR",
  "spain": "ES", "sweden": "SE", "switzerland": "CH", "taiwan": "TW",
  "thailand": "TH", "turkey": "TR", "turkiye": "TR", "ukraine": "UA",
  "united arab emirates": "AE", "uae": "AE", "united kingdom": "GB", "uk": "GB",
  "united states": "US", "usa": "US", "vietnam": "VN",
};

function resolveCountryCodes(locationStr: string): string[] {
  if (!locationStr || !locationStr.trim()) return [];

  // Split by comma for multiple countries (e.g., "Netherlands, Belgium")
  const parts = locationStr.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  const codes: string[] = [];

  for (const part of parts) {
    // Check if it's already a 2-letter ISO code
    if (part.length === 2 && /^[a-z]{2}$/.test(part)) {
      codes.push(part.toUpperCase());
      continue;
    }
    const mapped = COUNTRY_MAP[part];
    if (mapped) {
      codes.push(mapped);
    } else {
      console.warn(`[LOCATION] Unknown country: "${part}" — skipping`);
    }
  }

  return codes;
}

function buildTargetingSpec(
  placements: string,
  placementOptions: Record<string, boolean> | null,
  options: {
    targetGender?: string;
    targetAge?: string;
    location?: string;
  }
) {
  const targeting: Record<string, unknown> = {};

  // Geo locations (required by Meta)
  const countryCodes = resolveCountryCodes(options.location || "");
  if (countryCodes.length > 0) {
    targeting.geo_locations = {
      countries: countryCodes,
    };
  }

  // Age range
  if (options.targetAge) {
    const parts = options.targetAge.replace("+", "").split("-");
    targeting.age_min = parseInt(parts[0]) || 18;
    targeting.age_max = parseInt(parts[1]) || 65;
  }

  // Gender: All=0 (no filter), Male=1, Female=2
  if (options.targetGender === "Male") targeting.genders = [1];
  else if (options.targetGender === "Female") targeting.genders = [2];

  // Placements
  if (placements === "Manual" && placementOptions) {
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

function deriveOptimizationGoal(objective: string, conversionLocation?: string): string {
  if (objective === "OUTCOME_SALES") return "OFFSITE_CONVERSIONS";
  if (objective === "OUTCOME_LEADS" && conversionLocation === "On Ad") return "LEAD_GENERATION";
  if (objective === "OUTCOME_LEADS") return "OFFSITE_CONVERSIONS";
  if (objective === "OUTCOME_AWARENESS") return "REACH";
  if (objective === "OUTCOME_TRAFFIC") return "LINK_CLICKS";
  return "OFFSITE_CONVERSIONS";
}

function parseAttributionSetting(setting: string): Array<{ event_type: string; window_days: number }> {
  const spec: Array<{ event_type: string; window_days: number }> = [];

  const clickMatch = setting.match(/(\d+)d_click/);
  if (clickMatch) {
    spec.push({ event_type: "CLICK_THROUGH", window_days: parseInt(clickMatch[1]) });
  }

  const viewMatch = setting.match(/(\d+)d_view/);
  if (viewMatch) {
    spec.push({ event_type: "VIEW_THROUGH", window_days: parseInt(viewMatch[1]) });
  }

  // Fallback to 7-day click + 1-day view
  if (spec.length === 0) {
    spec.push(
      { event_type: "CLICK_THROUGH", window_days: 7 },
      { event_type: "VIEW_THROUGH", window_days: 1 }
    );
  }

  return spec;
}

function derivePromotedObject(
  objective: string,
  conversionLocation: string | undefined,
  pixelId: string | undefined,
  pageId: string | undefined
): Record<string, string> | null {
  if (objective === "OUTCOME_SALES") {
    return pixelId ? { pixel_id: pixelId, custom_event_type: "PURCHASE" } : null;
  }
  if (objective === "OUTCOME_LEADS" && conversionLocation === "On Ad") {
    return pageId ? { page_id: pageId } : null;
  }
  if (objective === "OUTCOME_LEADS") {
    return pixelId ? { pixel_id: pixelId, custom_event_type: "LEAD" } : null;
  }
  if (objective === "OUTCOME_AWARENESS") {
    return pageId ? { page_id: pageId } : null;
  }
  return null;
}

async function metaPost(
  path: string,
  body: Record<string, unknown>,
  accessToken: string
) {
  console.log(`[META POST] ${path}`, JSON.stringify(body, null, 2));

  const formData = new URLSearchParams();
  formData.append("access_token", accessToken);
  for (const [key, value] of Object.entries(body)) {
    if (value === null || value === undefined) continue;
    formData.append(
      key,
      typeof value === "object" ? JSON.stringify(value) : String(value)
    );
  }

  const res = await fetch(metaUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });
  const data = await res.json();
  console.log(`[META RESPONSE] ${path}`, JSON.stringify(data, null, 2));
  return data;
}

// ── Upload image to Meta via adimages endpoint (returns hash) ──
// Used only by asset_feed_spec paths where image_hash is needed (e.g., story variants)
async function uploadImageToMeta(
  accountId: string,
  imageUrl: string,
  accessToken: string,
  supabase: ReturnType<typeof createServiceClient>,
  orgId: string
): Promise<string> {
  // Check media cache first
  const { data: cached } = await supabase
    .from("media_cache")
    .select("meta_media_id")
    .eq("cloudinary_url", imageUrl)
    .limit(1)
    .single();

  if (cached?.meta_media_id) return cached.meta_media_id;

  // Upload via URL
  const res = await metaPost(`act_${accountId}/adimages`, { url: imageUrl }, accessToken);

  if (res.error) throw new Error(`Image upload failed: ${res.error.message}`);

  const images = res.images;
  const hash = images ? Object.values(images)[0]?.hash : null;
  if (!hash) throw new Error("No image hash returned from Meta");

  // Cache it
  await supabase.from("media_cache").insert({
    organization_id: orgId,
    cloudinary_url: imageUrl,
    meta_media_id: hash as string,
    media_type: "Image",
  });

  return hash as string;
}

// ── Creative builder context ──
interface CreativeCtx {
  pageId: string;
  instagramId: string | null;
  adSetConvLoc: string;
}

// deno-lint-ignore no-explicit-any
type AdInput = Record<string, any>;

// ══════════════════════════════════════════════════════════════════
// 1. SIMPLE IMAGE — object_story_spec with picture URL
//    Used when: SINGLE_IMAGE + no story variant + single text
// ══════════════════════════════════════════════════════════════════
function buildSimpleImageCreative(adInput: AdInput, ctx: CreativeCtx): Record<string, unknown> {
  const headlines = adInput.headlines || [];
  const primaryTexts = adInput.primary_texts || [];

  const ctaValue = (ctx.adSetConvLoc === "On Ad" && adInput.lead_form_id)
    ? { lead_gen_form_id: adInput.lead_form_id }
    : { link: adInput.url || "" };

  const linkData: Record<string, unknown> = {
    message: primaryTexts[0] || "",
    name: headlines[0] || "",
    link: adInput.url || "",
    call_to_action: {
      type: adInput.call_to_action || "SHOP_NOW",
      value: ctaValue,
    },
  };

  // Use picture URL directly — Meta fetches it server-side (no adimages permission needed)
  if (adInput.square_image_url) {
    linkData.picture = adInput.square_image_url;
  }

  return {
    name: `Creative - ${adInput.name}`,
    object_story_spec: {
      page_id: ctx.pageId,
      ...(ctx.instagramId ? { instagram_user_id: ctx.instagramId } : {}),
      link_data: linkData,
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// 2. SIMPLE CAROUSEL — object_story_spec with child_attachments using picture URLs
//    Used when: CAROUSEL + no story variants
// ══════════════════════════════════════════════════════════════════
function buildSimpleCarouselCreative(adInput: AdInput, ctx: CreativeCtx): Record<string, unknown> {
  const primaryTexts = adInput.primary_texts || [];

  const childAttachments = (adInput.carousel_cards || [])
    .filter((card: AdInput) => card.image_url)
    .map((card: AdInput) => ({
      name: card.title || "",
      link: card.url || adInput.url || "",
      picture: card.image_url,
    }));

  const ctaValue = (ctx.adSetConvLoc === "On Ad" && adInput.lead_form_id)
    ? { lead_gen_form_id: adInput.lead_form_id }
    : { link: adInput.url || "" };

  return {
    name: `Creative - ${adInput.name}`,
    object_story_spec: {
      page_id: ctx.pageId,
      ...(ctx.instagramId ? { instagram_user_id: ctx.instagramId } : {}),
      link_data: {
        message: primaryTexts[0] || "",
        link: adInput.url || "",
        child_attachments: childAttachments,
        call_to_action: {
          type: adInput.call_to_action || "SHOP_NOW",
          value: ctaValue,
        },
      },
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// 3. ASSET FEED IMAGE — asset_feed_spec with URL-based images
//    Used when: SINGLE_IMAGE + (story variant OR multiple texts)
//    Uses image URL by default; falls back to hash when story
//    variant needs placement-based customization rules
// ══════════════════════════════════════════════════════════════════
async function buildAssetFeedImageCreative(
  adInput: AdInput,
  ctx: CreativeCtx & { accountId: string; accessToken: string; supabase: ReturnType<typeof createServiceClient>; orgId: string },
): Promise<Record<string, unknown>> {
  const headlines = adInput.headlines || [];
  const primaryTexts = adInput.primary_texts || [];

  const assetFeedSpec: Record<string, unknown> = {
    bodies: primaryTexts.map((t: string) => ({ text: t })),
    titles: headlines.map((t: string) => ({ text: t })),
    link_urls: [{ website_url: adInput.url || "" }],
    call_to_action_types: [adInput.call_to_action || "SHOP_NOW"],
  };

  const hasStory = !!adInput.story_image_url;

  if (hasStory && adInput.square_image_url) {
    // Two images with placement customization (feed vs story)
    // Try hash-based upload for adlabels support; fall back to URL if permission fails
    try {
      const squareHash = await uploadImageToMeta(ctx.accountId, adInput.square_image_url, ctx.accessToken, ctx.supabase, ctx.orgId);
      const storyHash = await uploadImageToMeta(ctx.accountId, adInput.story_image_url, ctx.accessToken, ctx.supabase, ctx.orgId);

      assetFeedSpec.images = [
        { hash: squareHash, adlabels: [{ name: "feed_image" }] },
        { hash: storyHash, adlabels: [{ name: "story_image" }] },
      ];
      assetFeedSpec.asset_customization_rules = [
        {
          image_label: { name: "feed_image" },
          customization_spec: {
            publisher_platforms: ["facebook", "instagram"],
            facebook_positions: ["feed"],
            instagram_positions: ["stream", "explore", "explore_home"],
          },
        },
        {
          image_label: { name: "story_image" },
          customization_spec: {
            publisher_platforms: ["facebook", "instagram"],
            facebook_positions: ["story", "facebook_reels"],
            instagram_positions: ["story", "reels"],
          },
        },
      ];
    } catch {
      // Fallback: use URLs directly (no placement customization)
      console.warn("[ASSET FEED] Hash upload failed, falling back to URL-based images");
      assetFeedSpec.images = [{ url: adInput.square_image_url }];
    }
  } else if (adInput.square_image_url) {
    // Single image, use URL directly
    assetFeedSpec.images = [{ url: adInput.square_image_url }];
  }

  const creativeSpec: Record<string, unknown> = {
    name: `Creative - ${adInput.name}`,
    asset_feed_spec: assetFeedSpec,
    object_type: "SHARE",
  };

  if (adInput.advantage_creative_config) {
    creativeSpec.degrees_of_freedom_spec = {
      creative_features_spec: adInput.advantage_creative_config,
    };
  }

  return creativeSpec;
}

// ══════════════════════════════════════════════════════════════════
// 4. ASSET FEED CAROUSEL — asset_feed_spec with carousel + story
//    Used when: CAROUSEL + story variants (future implementation)
// ══════════════════════════════════════════════════════════════════
function buildAssetFeedCarouselCreative(_adInput: AdInput, _ctx: CreativeCtx): Record<string, unknown> {
  // TODO: Implement when story (9:16) support is added for carousel
  throw new Error("Asset feed carousel with story variants is not yet supported");
}

/**
 * Full campaign creation orchestrator.
 *
 * Input: {
 *   account_id: "123456789",
 *   organization_id: "uuid",
 *   campaign: { name, objective, buying_type, bid_strategy, advantage_campaign_budget, ... },
 *   campaign_type: "new" | "existing",
 *   existing_campaign_id: "meta_campaign_id" (if type=existing),
 *   ad_sets: [{
 *     type: "new" | "existing",
 *     existing_adset_id: "meta_adset_id",
 *     name, template_fields: { ... },
 *     ads: [{
 *       name, headlines, primary_texts,
 *       call_to_action, url_parameters,
 *       square_image_url, story_image_url,
 *       advantage_creative_config
 *     }]
 *   }]
 * }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getUser(req);

    const body = await req.json();
    console.log("[INPUT] meta-create-campaign", JSON.stringify(body, null, 2));
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
    } = body;

    if (!account_id || !organization_id) {
      return new Response(
        JSON.stringify({ error: "account_id and organization_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getAccessToken(account_id);
    const supabase = createServiceClient();

    // Look up the Supabase ad_account row ID (needed for FK references)
    const { data: adAccountRow } = await supabase
      .from("ad_accounts")
      .select("id")
      .eq("account_id", account_id)
      .limit(1)
      .single();
    const adAccountDbId = adAccountRow?.id;

    const results: {
      campaign_id?: string;
      meta_campaign_id?: string;
      ad_sets: Array<{
        name: string;
        db_adset_id?: string;
        meta_adset_id?: string;
        status: string;
        error?: string;
        ads: Array<{
          name: string;
          meta_ad_id?: string;
          status: string;
          error?: string;
        }>;
      }>;
    } = { ad_sets: [] };

    // ── Step 1: Create or use existing campaign ──
    let metaCampaignId: string;

    if (campaign_type === "existing" && existing_campaign_id) {
      metaCampaignId = existing_campaign_id;
      results.meta_campaign_id = metaCampaignId;
    } else {
      // Build campaign params
      // Meta requires ["NONE"] when no special categories apply (not an empty array)
      const specialCats = campaign.special_ad_categories || [];
      const metaSpecialCats = specialCats.length === 0 || (specialCats.length === 1 && specialCats[0] === "NONE")
        ? ["NONE"]
        : specialCats.filter((c: string) => c !== "NONE");

      const campaignParams: Record<string, unknown> = {
        name: campaign.name,
        objective: campaign.objective,
        status: "PAUSED",
        special_ad_categories: metaSpecialCats,
      };

      if (campaign.buying_type) campaignParams.buying_type = campaign.buying_type;

      // Promoted object for Advantage+ Catalog campaigns
      if (campaign.advantage_plus_catalog && campaign.catalog_id) {
        campaignParams.promoted_object = { product_catalog_id: campaign.catalog_id };
      }

      // CBO: send budget + bid_strategy at campaign level
      if (campaign.advantage_campaign_budget) {
        if (campaign.campaign_budget_type === "Daily" && campaign.campaign_budget_value) {
          campaignParams.daily_budget = Math.round(campaign.campaign_budget_value * 100); // cents
        } else if (campaign.campaign_budget_type === "Lifetime" && campaign.campaign_budget_value) {
          campaignParams.lifetime_budget = Math.round(campaign.campaign_budget_value * 100);
        }
        // bid_strategy only valid at campaign level when campaign has a budget (CBO)
        const campBidStrategy = campaign?.bid_strategy;
        if (campBidStrategy) {
          campaignParams.bid_strategy = campBidStrategy;
        }
      }

      const campaignRes = await metaPost(
        `act_${account_id}/campaigns`,
        campaignParams,
        accessToken
      );

      if (campaignRes.error) {
        const metaMsg = campaignRes.error.error_user_msg || campaignRes.error.message;
        await logError({
          functionName: "meta-create-campaign",
          errorType: "META_API",
          errorMessage: metaMsg,
          organizationId: organization_id,
          context: { step: "create_campaign", campaign_name: campaign.name, params_sent: campaignParams },
        });
        return new Response(
          JSON.stringify({
            error: `Campaign creation failed: ${metaMsg}`,
            debug: { params_sent: campaignParams, meta_response: campaignRes },
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      metaCampaignId = campaignRes.id;
      results.meta_campaign_id = metaCampaignId;

      // Save campaign to Supabase
      if (adAccountDbId) {
        const { data: dbCampaign } = await supabase.from("campaigns").insert({
          organization_id,
          ad_account_id: adAccountDbId,
          meta_campaign_id: metaCampaignId,
          name: campaign.name,
          objective: campaign.objective,
          buying_type: campaign.buying_type || "AUCTION",
          bid_strategy: campaign.bid_strategy || null,
          advantage_campaign_budget: campaign.advantage_campaign_budget || false,
          campaign_budget_type: campaign.campaign_budget_type || null,
          campaign_budget_value: campaign.campaign_budget_value || null,
          special_ad_categories: campaign.special_ad_categories || [],
          status: "CREATED",
          meta_status: "PAUSED",
        }).select("id").single();
        if (dbCampaign) results.campaign_id = dbCampaign.id;
      }
    }

    // ── Step 2: Create ad sets + ads ──
    for (const adSetInput of ad_sets || []) {
      const adSetResult: (typeof results.ad_sets)[0] = {
        name: adSetInput.name,
        status: "PENDING",
        ads: [],
      };

      let metaAdsetId: string;
      // Resolve conversion location for use in ad creative (accessible in both new and existing adset paths)
      const adSetTf = adSetInput.template_fields || {};
      const adSetConvLoc = adSetTf.adsetConversionLocation || adSetTf.adset_conversion_location || "";

      if (adSetInput.type === "existing" && adSetInput.existing_adset_id) {
        metaAdsetId = adSetInput.existing_adset_id;
        adSetResult.meta_adset_id = metaAdsetId;
        adSetResult.status = "EXISTING";
      } else {
        // Build adset params from template fields
        const tf = adSetInput.template_fields || {};
        const objective = campaign?.objective || "OUTCOME_SALES";
        const convLoc = tf.adsetConversionLocation || tf.adset_conversion_location;
        const optimizationGoal = deriveOptimizationGoal(objective, convLoc);
        const promotedObject = derivePromotedObject(
          objective,
          convLoc,
          tf.pixelId || tf.pixel_id || pixel_id,
          page_id
        );

        const targeting = buildTargetingSpec(
          tf.placements || "Automatic",
          tf.placementOptions || tf.placement_options || null,
          {
            targetGender: tf.targetGender || tf.target_gender,
            targetAge: tf.targetAge || tf.target_age,
            location: tf.location,
          }
        );

        const adsetParams: Record<string, unknown> = {
          campaign_id: metaCampaignId,
          name: adSetInput.name,
          optimization_goal: optimizationGoal,
          billing_event: "IMPRESSIONS",
          status: "PAUSED",
          targeting,
        };

        if (promotedObject) adsetParams.promoted_object = promotedObject;

        // Budget & bid strategy (only if CBO is OFF — otherwise budget is at campaign level)
        if (!campaign?.advantage_campaign_budget) {
          const bidStrategy = tf.bidStrategy || tf.bid_strategy;
          if (bidStrategy) {
            adsetParams.bid_strategy = bidStrategy;
          }
          // bid_amount required for LOWEST_COST_WITH_BID_CAP, COST_CAP
          const bidAmount = tf.bidAmount || tf.bid_amount;
          if (bidAmount && (bidStrategy === "LOWEST_COST_WITH_BID_CAP" || bidStrategy === "COST_CAP")) {
            adsetParams.bid_amount = Math.round(bidAmount * 100); // cents
          }
          const budgetType = tf.adsetBudgetType || tf.adset_budget_type || "Daily";
          const budgetValue = tf.adsetBudgetValue || tf.adset_budget_value;
          if (budgetValue) {
            if (budgetType === "Daily") adsetParams.daily_budget = Math.round(budgetValue * 100);
            else adsetParams.lifetime_budget = Math.round(budgetValue * 100);
          }
        }

        // Attribution spec (for website conversions)
        if (
          optimizationGoal === "OFFSITE_CONVERSIONS" &&
          (tf.attributionSetting || tf.attribution_setting)
        ) {
          const attrSetting = tf.attributionSetting || tf.attribution_setting;
          adsetParams.attribution_spec = parseAttributionSetting(attrSetting);
        }

        // Dynamic creative
        if (tf.dynamicCreative || tf.dynamic_creative) {
          adsetParams.dynamic_creative = true;
        }

        // Start time
        if (tf.startDate || tf.start_date) {
          adsetParams.start_time = tf.startDate || tf.start_date;
        }
        if ((tf.setEndDate || tf.set_end_date) && (tf.endDate || tf.end_date)) {
          adsetParams.end_time = tf.endDate || tf.end_date;
        }

        // Destination type for lead gen (On Ad)
        if (convLoc === "On Ad") {
          adsetParams.destination_type = "ON_AD";
        }

        // DSA fields (required for EU advertising — Digital Services Act)
        if (page_id) {
          adsetParams.dsa_beneficiary = page_id;
          adsetParams.dsa_payor = page_id;
        }

        try {
          const adsetRes = await metaPost(
            `act_${account_id}/adsets`,
            adsetParams,
            accessToken
          );

          if (adsetRes.error) {
            adSetResult.status = "FAILED";
            adSetResult.error = adsetRes.error.error_user_msg || adsetRes.error.message;
            // Include the params we sent for debugging
            console.error("[ADSET PARAMS SENT]", JSON.stringify(adsetParams, null, 2));
            await logError({
              functionName: "meta-create-campaign",
              errorType: "META_API",
              errorMessage: adsetRes.error.message,
              organizationId: organization_id,
              context: { step: "create_adset", adset_name: adSetInput.name },
            });
            results.ad_sets.push(adSetResult);
            continue;
          }

          metaAdsetId = adsetRes.id;
          adSetResult.meta_adset_id = metaAdsetId;
          adSetResult.status = "CREATED";

          // Save ad set to Supabase
          if (results.campaign_id) {
            const { data: dbAdSet } = await supabase.from("ad_sets").insert({
              organization_id,
              campaign_id: results.campaign_id,
              meta_adset_id: metaAdsetId,
              name: adSetInput.name,
              optimization_goal: optimizationGoal,
              conversion_location: convLoc || null,
              bid_strategy: tf.bidStrategy || tf.bid_strategy || null,
              budget_type: tf.adsetBudgetType || tf.adset_budget_type || null,
              budget_value: tf.adsetBudgetValue || tf.adset_budget_value || null,
              placements: tf.placements || "Automatic",
              placement_options: tf.placementOptions || tf.placement_options || {},
              pixel_id: tf.pixelId || tf.pixel_id || pixel_id || null,
              status: "CREATED",
              meta_status: "PAUSED",
            }).select("id").single();
            if (dbAdSet) adSetResult.db_adset_id = dbAdSet.id;
          }
        } catch (err) {
          adSetResult.status = "FAILED";
          adSetResult.error = (err as Error).message;
          results.ad_sets.push(adSetResult);
          continue;
        }
      }

      // ── Step 3: Create ads within this ad set ──
      for (const adInput of adSetInput.ads || []) {
        const adResult: (typeof adSetResult.ads)[0] = {
          name: adInput.name,
          status: "PENDING",
        };

        try {
          // Normalize input field names
          if (adInput.titles && !adInput.headlines) adInput.headlines = adInput.titles;
          if (adInput.ad_copies && !adInput.primary_texts) adInput.primary_texts = adInput.ad_copies;

          const headlines = adInput.headlines || [];
          const primaryTexts = adInput.primary_texts || [];
          const creativeType = adInput.creative_type || "SINGLE_IMAGE";
          const hasStory = !!adInput.story_image_url;
          const isCarousel = creativeType === "CAROUSEL" && adInput.carousel_cards?.length > 0;
          const isMultiVariant = headlines.length > 1 || primaryTexts.length > 1;

          const creativeCtx: CreativeCtx = {
            pageId: page_id || "",
            instagramId: instagram_id || null,
            adSetConvLoc,
          };

          // ── Dispatch to the right creative builder ──
          let creativeSpec: Record<string, unknown>;

          if (isCarousel && hasStory) {
            // Future: asset_feed carousel with story variants
            creativeSpec = buildAssetFeedCarouselCreative(adInput, creativeCtx);
          } else if (isCarousel) {
            // Simple carousel: picture URLs in child_attachments
            creativeSpec = buildSimpleCarouselCreative(adInput, creativeCtx);
          } else if (hasStory || isMultiVariant) {
            // Asset feed: multiple texts or story variant (uses URL for images)
            creativeSpec = await buildAssetFeedImageCreative(adInput, {
              ...creativeCtx,
              accountId: account_id,
              accessToken,
              supabase,
              orgId: organization_id,
            });
          } else {
            // Simple single image: picture URL in link_data
            creativeSpec = buildSimpleImageCreative(adInput, creativeCtx);
          }

          console.log(`[CREATIVE SPEC] ${adInput.name}`, JSON.stringify(creativeSpec, null, 2));

          // Create ad creative
          const creativeRes = await metaPost(
            `act_${account_id}/adcreatives`,
            creativeSpec,
            accessToken
          );

          if (creativeRes.error) {
            adResult.status = "FAILED";
            adResult.error = `Creative: ${creativeRes.error.error_user_msg || creativeRes.error.message}`;
            await logError({
              functionName: "meta-create-campaign",
              errorType: "META_API",
              errorMessage: creativeRes.error.message,
              organizationId: organization_id,
              context: { step: "create_creative", ad_name: adInput.name },
            });
            adSetResult.ads.push(adResult);
            continue;
          }

          // Create ad linking creative to adset
          const adParams: Record<string, unknown> = {
            name: adInput.name,
            adset_id: metaAdsetId,
            creative: { creative_id: creativeRes.id },
            status: "PAUSED",
          };

          if (adInput.url_parameters) {
            adParams.url_tags = adInput.url_parameters;
          }

          // Tracking specs for pixel-based conversion tracking
          const effectivePixelId = adSetInput.template_fields?.pixelId || adSetInput.template_fields?.pixel_id || pixel_id;
          if (effectivePixelId) {
            adParams.tracking_specs = [
              { "action.type": ["offsite_conversion"], "fb_pixel": [effectivePixelId] },
            ];
          }

          const adRes = await metaPost(
            `act_${account_id}/ads`,
            adParams,
            accessToken
          );

          if (adRes.error) {
            adResult.status = "FAILED";
            adResult.error = `Ad: ${adRes.error.error_user_msg || adRes.error.message}`;
            await logError({
              functionName: "meta-create-campaign",
              errorType: "META_API",
              errorMessage: adRes.error.message,
              organizationId: organization_id,
              context: { step: "create_ad", ad_name: adInput.name, adset_id: metaAdsetId },
            });
          } else {
            adResult.meta_ad_id = adRes.id;
            adResult.status = "CREATED";

            // Save ad to Supabase
            if (adSetResult.db_adset_id) {
              await supabase.from("ads").insert({
                organization_id,
                ad_set_id: adSetResult.db_adset_id,
                meta_ad_id: adRes.id,
                name: adInput.name,
                ad_copies: primaryTexts,
                titles: headlines,
                url: adInput.url || null,
                call_to_action: adInput.call_to_action || null,
                url_parameters: adInput.url_parameters || null,
                square_image_url: adInput.square_image_url || null,
                story_image_url: adInput.story_image_url || null,
                advantage_creative_config: adInput.advantage_creative_config || null,
                carousel_cards: creativeType === "CAROUSEL" ? (adInput.carousel_cards || []) : [],
                status: "CREATED",
                meta_status: "PAUSED",
              });
            }
          }
        } catch (err) {
          adResult.status = "FAILED";
          adResult.error = (err as Error).message;
        }

        adSetResult.ads.push(adResult);
      }

      results.ad_sets.push(adSetResult);
    }

    return new Response(
      JSON.stringify(results),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    await logError({
      functionName: "meta-create-campaign",
      errorType: "INTERNAL",
      errorMessage: (err as Error).message,
      context: {},
    });
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
