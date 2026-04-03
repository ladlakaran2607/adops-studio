import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, metaUrl, logError } from "../_shared/supabase.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated
    await getUser(req);

    const body = await req.json();
    console.log("[INPUT] meta-validate-token", JSON.stringify({ has_token: !!body.access_token }));
    const { access_token } = body;
    if (!access_token) {
      return new Response(
        JSON.stringify({ error: "access_token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate token against Meta API
    const res = await fetch(
      metaUrl(`me?fields=id,name&access_token=${encodeURIComponent(access_token)}`)
    );
    const data = await res.json();
    console.log("[META RESPONSE] /me", JSON.stringify(data));

    if (data.error) {
      return new Response(
        JSON.stringify({ valid: false, error: data.error.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ valid: true, user_id: data.id, user_name: data.name }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    await logError({
      functionName: "meta-validate-token",
      errorType: "AUTH",
      errorMessage: (err as Error).message,
    });
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
