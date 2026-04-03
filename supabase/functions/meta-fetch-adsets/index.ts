import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, getAccessToken, metaUrl, logError } from "../_shared/supabase.ts";

/**
 * Fetches ad sets from Meta API for a given ad account.
 *
 * Input:  { account_id: "123456789" }
 * Output: { ad_sets: [{ id, name, campaign_name }] }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getUser(req);
    const { account_id } = await req.json();
    console.log("[INPUT] meta-fetch-adsets", JSON.stringify({ account_id }));

    if (!account_id) {
      return new Response(
        JSON.stringify({ error: "account_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getAccessToken(account_id);

    const allAdSets: unknown[] = [];
    let url: string | null = metaUrl(
      `act_${account_id}/adsets?fields=id,name,status,campaign{id,name}&limit=100&access_token=${encodeURIComponent(accessToken)}`
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

      if (page.data) allAdSets.push(...page.data);
      url = page.paging?.next ?? null;
    }

    const ad_sets = allAdSets.map((as: any) => ({
      id: as.id,
      name: as.name,
      status: as.status,
      campaign_name: as.campaign?.name || "",
      campaign_id: as.campaign?.id || "",
    }));

    console.log(`[OUTPUT] meta-fetch-adsets: ${ad_sets.length} ad sets fetched`);
    return new Response(
      JSON.stringify({ ad_sets }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    await logError({
      functionName: "meta-fetch-adsets",
      errorType: "META_API",
      errorMessage: (err as Error).message,
    });
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
