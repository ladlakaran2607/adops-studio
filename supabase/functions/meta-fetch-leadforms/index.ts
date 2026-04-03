import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  getUser,
  getAccessToken,
  metaUrl,
  logError,
} from "../_shared/supabase.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getUser(req);
    const { account_id, page_id } = await req.json();

    if (!account_id || !page_id) {
      return new Response(
        JSON.stringify({ error: "account_id and page_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Get the user access token for this ad account
    const userAccessToken = await getAccessToken(account_id);

    // Step 2: Call /me/accounts to get page-specific access tokens
    let pageAccessToken: string | null = null;
    let pagesUrl: string | null = metaUrl(
      `me/accounts?fields=id,access_token&limit=100&access_token=${encodeURIComponent(userAccessToken)}`
    );

    while (pagesUrl && !pageAccessToken) {
      const pagesRes: Response = await fetch(pagesUrl);
      const pagesData: { data?: { id: string; access_token: string }[]; paging?: { next?: string }; error?: { message: string } } = await pagesRes.json();

      if (pagesData.error) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch pages: ${pagesData.error.message}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const matchingPage = (pagesData.data || []).find(
        (p: { id: string }) => p.id === page_id
      );

      if (matchingPage) {
        pageAccessToken = matchingPage.access_token;
      }

      pagesUrl = pagesData.paging?.next ?? null;
    }

    if (!pageAccessToken) {
      return new Response(
        JSON.stringify({ error: `Page ${page_id} not found in your managed pages. Check that the Page ID is correct and the token has pages_manage_ads permission.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Fetch lead forms using the page access token
    const res = await fetch(
      metaUrl(`${page_id}/leadgen_forms?fields=id,name,status&access_token=${encodeURIComponent(pageAccessToken)}`)
    );
    const data = await res.json();

    if (data.error) {
      return new Response(
        JSON.stringify({ error: data.error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const forms = (data.data || []).map((f: Record<string, unknown>) => ({
      id: f.id,
      name: f.name,
      status: f.status,
    }));

    return new Response(
      JSON.stringify({ forms }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    await logError({
      functionName: "meta-fetch-leadforms",
      errorType: "META_API",
      errorMessage: (err as Error).message,
    });
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
