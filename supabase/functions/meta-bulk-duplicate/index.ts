import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, getAccessToken, metaUrl, logError } from "../_shared/supabase.ts";

/**
 * Bulk duplicate ads to multiple ad sets via Meta's ad copy endpoint.
 *
 * Input: {
 *   account_id: "123456789",
 *   source_ad_ids: ["ad_id_1", "ad_id_2"],
 *   target_adset_ids: ["adset_id_1", "adset_id_2"]
 * }
 *
 * Output: {
 *   results: [{ source_ad_id, target_adset_id, status, new_ad_id?, error? }]
 * }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getUser(req);
    const { account_id, source_ad_ids, target_adset_ids } = await req.json();
    console.log("[INPUT] meta-bulk-duplicate", JSON.stringify({ account_id, source_ads: source_ad_ids?.length, target_adsets: target_adset_ids?.length }));

    if (!account_id || !source_ad_ids?.length || !target_adset_ids?.length) {
      return new Response(
        JSON.stringify({ error: "account_id, source_ad_ids, and target_adset_ids are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getAccessToken(account_id);

    // For each (ad, adset) combination, copy the ad to the target adset
    const results: Array<{
      source_ad_id: string;
      target_adset_id: string;
      status: "success" | "error";
      new_ad_id?: string;
      error?: string;
    }> = [];

    for (const adId of source_ad_ids) {
      for (const adsetId of target_adset_ids) {
        try {
          const res = await fetch(metaUrl(`${adId}/copies`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              adset_id: adsetId,
              status_option: "PAUSED",
              access_token: accessToken,
            }),
          });

          const data = await res.json();
          console.log(`[META RESPONSE] ${adId}/copies → ${adsetId}`, JSON.stringify(data));

          if (data.error) {
            results.push({
              source_ad_id: adId,
              target_adset_id: adsetId,
              status: "error",
              error: data.error.message,
            });
          } else {
            // Meta returns { copied_ad_id: "..." } or { ad_object_ids: ["..."] }
            const newAdId =
              data.copied_ad_id ||
              (data.ad_object_ids && data.ad_object_ids[0]) ||
              null;

            results.push({
              source_ad_id: adId,
              target_adset_id: adsetId,
              status: "success",
              new_ad_id: newAdId,
            });
          }
        } catch (err) {
          results.push({
            source_ad_id: adId,
            target_adset_id: adsetId,
            status: "error",
            error: (err as Error).message,
          });
        }
      }
    }

    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    // Log individual failures to error_logs
    for (const r of results.filter((r) => r.status === "error")) {
      await logError({
        functionName: "meta-bulk-duplicate",
        errorType: "META_API",
        errorMessage: r.error || "Unknown duplication error",
        context: { account_id, source_ad_id: r.source_ad_id, target_adset_id: r.target_adset_id },
      });
    }

    console.log(`[OUTPUT] meta-bulk-duplicate: ${successCount} success, ${errorCount} errors`);
    return new Response(
      JSON.stringify({ results, summary: { total: results.length, success: successCount, errors: errorCount } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    await logError({
      functionName: "meta-bulk-duplicate",
      errorType: "INTERNAL",
      errorMessage: (err as Error).message,
    });
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
