import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, getAccessToken, metaUrl, logError } from "../_shared/supabase.ts";

/**
 * Fetches campaigns from Meta API for a given ad account (paginated).
 *
 * Input:  { account_id: "123456789" }
 * Output: { campaigns: [{ id, name, status, objective }] }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getUser(req);
    const { account_id } = await req.json();
    console.log("[INPUT] meta-fetch-campaigns", JSON.stringify({ account_id }));

    if (!account_id) {
      return new Response(
        JSON.stringify({ error: "account_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getAccessToken(account_id);

    const allCampaigns: unknown[] = [];
    let url: string | null = metaUrl(
      `act_${account_id}/campaigns?fields=id,name,status,objective&limit=100&access_token=${encodeURIComponent(accessToken)}`
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

      if (page.data) allCampaigns.push(...page.data);
      url = page.paging?.next ?? null;
    }

    const campaigns = allCampaigns.map((c: any) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      objective: c.objective || "",
    }));

    console.log(`[OUTPUT] meta-fetch-campaigns: ${campaigns.length} campaigns fetched`);
    return new Response(
      JSON.stringify({ campaigns }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    await logError({
      functionName: "meta-fetch-campaigns",
      errorType: "META_API",
      errorMessage: (err as Error).message,
    });
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
