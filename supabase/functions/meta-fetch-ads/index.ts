import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, getAccessToken, metaUrl, logError } from "../_shared/supabase.ts";

/**
 * Fetches ads from Meta API for a given ad account.
 * Returns structured ad data with text variants from asset_feed_spec.
 *
 * Input:  { account_id: "123456789" }
 * Output: { ads: [{ id, name, status, ad_type, headlines, bodies, descriptions }] }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getUser(req);
    const { account_id } = await req.json();
    console.log("[INPUT] meta-fetch-ads", JSON.stringify({ account_id }));

    if (!account_id) {
      return new Response(
        JSON.stringify({ error: "account_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getAccessToken(account_id);

    // Fetch ads with creative details — paginate through all results
    const allAds: unknown[] = [];
    let url: string | null = metaUrl(
      `act_${account_id}/ads?fields=id,name,status,ad_schedule_start_time,ad_schedule_end_time,campaign{id,name},adset{id,name},creative{id,asset_feed_spec,object_story_spec,effective_object_story_id}&limit=100&access_token=${encodeURIComponent(accessToken)}`
    );

    while (url) {
      const res = await fetch(url);
      const page = await res.json();

      if (page.error) {
        return new Response(
          JSON.stringify({ error: page.error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (page.data) allAds.push(...page.data);
      url = page.paging?.next ?? null;
    }

    // Parse each ad into a structured format
    const ads = allAds.map((ad: any) => {
      const creative = ad.creative || {};
      const afs = creative.asset_feed_spec;
      const oss = creative.object_story_spec;

      let headlines: string[] = [];
      let bodies: string[] = [];
      let descriptions: string[] = [];
      let adType: "IMAGE" | "VIDEO" | "CAROUSEL" = "IMAGE";

      if (afs) {
        // Advanced mode: asset_feed_spec has arrays of titles, bodies, descriptions
        headlines = (afs.titles || []).map((t: any) => t.text);
        bodies = (afs.bodies || []).map((b: any) => b.text);
        descriptions = (afs.descriptions || []).map((d: any) => d.text);

        if (afs.videos && afs.videos.length > 0) adType = "VIDEO";
        else if (afs.carousels || (afs.asset_customization_rules && JSON.stringify(afs).includes("CAROUSEL"))) adType = "CAROUSEL";
      } else if (oss) {
        // Simple mode: object_story_spec has link_data or video_data
        const ld = oss.link_data;
        const vd = oss.video_data;

        if (ld) {
          if (ld.child_attachments) {
            adType = "CAROUSEL";
            // Carousel children have their own titles/descriptions
            headlines = ld.child_attachments.map((c: any) => c.name || "").filter(Boolean);
            bodies = [ld.message || ""].filter(Boolean);
            descriptions = ld.child_attachments.map((c: any) => c.description || "").filter(Boolean);
          } else {
            headlines = [ld.name || ""].filter(Boolean);
            bodies = [ld.message || oss.message || ""].filter(Boolean);
            descriptions = [ld.description || ""].filter(Boolean);
          }
        }

        if (vd) {
          adType = "VIDEO";
          headlines = [vd.title || ""].filter(Boolean);
          bodies = [vd.message || oss.message || ""].filter(Boolean);
        }
      }

      return {
        id: ad.id,
        name: ad.name,
        status: ad.status,
        ad_type: adType,
        campaign_id: ad.campaign?.id || null,
        campaign_name: ad.campaign?.name || null,
        adset_id: ad.adset?.id || null,
        adset_name: ad.adset?.name || null,
        ad_schedule_start_time: ad.ad_schedule_start_time || null,
        ad_schedule_end_time: ad.ad_schedule_end_time || null,
        headlines,
        bodies,
        descriptions,
      };
    });

    console.log(`[OUTPUT] meta-fetch-ads: ${ads.length} ads fetched`);
    return new Response(
      JSON.stringify({ ads }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    await logError({
      functionName: "meta-fetch-ads",
      errorType: "META_API",
      errorMessage: (err as Error).message,
      context: { account_id: (await req.clone().json().catch(() => ({}))).account_id },
    });
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
