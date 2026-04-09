import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, createServiceClient, logError } from "../_shared/supabase.ts";

/**
 * OpenAI Proxy — thin pass-through to api.openai.com.
 *
 * Reads the OpenAI API key from platformCredentials (platform='openai', apikey column)
 * and forwards the user's request body to the specified OpenAI endpoint. Returns the
 * raw OpenAI response verbatim — all business logic (prompt, batching, validation)
 * lives in the frontend (src/lib/openaiClient.ts).
 *
 * This split exists so prompt iteration, batching, and parsing can be hot-reloaded
 * via Vite instead of requiring a 30s edge function deploy each time.
 *
 * Input: {
 *   endpoint: "chat/completions",     // whitelisted, see ALLOWED_ENDPOINTS
 *   payload:  { ...openai request }   // forwarded as-is to api.openai.com
 * }
 *
 * Output: the raw OpenAI response (whatever api.openai.com returned, including errors)
 */

const ALLOWED_ENDPOINTS = new Set([
  "chat/completions",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);

    const { endpoint, payload } = await req.json();

    if (!endpoint || typeof endpoint !== "string") {
      return new Response(
        JSON.stringify({ error: "endpoint is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Whitelist guard — prevents the frontend from accidentally hitting expensive
    // endpoints like images/generations or fine-tuning.
    if (!ALLOWED_ENDPOINTS.has(endpoint)) {
      return new Response(
        JSON.stringify({ error: `Endpoint not allowed: ${endpoint}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payload || typeof payload !== "object") {
      return new Response(
        JSON.stringify({ error: "payload is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the user's tenantId, then fetch the OpenAI key from platformCredentials
    const supabase = createServiceClient();

    const { data: userRow } = await supabase
      .from("User")
      .select("tenantId")
      .eq("supabaseUserId", user.id)
      .limit(1)
      .single();

    if (!userRow?.tenantId) {
      return new Response(
        JSON.stringify({ error: "User has no tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: cred } = await supabase
      .from("platformCredentials")
      .select("apikey")
      .eq("tenantId", userRow.tenantId)
      .eq("platform", "openai")
      .limit(1)
      .single();

    const apiKey = cred?.apikey;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not found in platformCredentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Forward to OpenAI
    const startTime = Date.now();
    const openaiRes = await fetch(`https://api.openai.com/v1/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const elapsedMs = Date.now() - startTime;
    const openaiData = await openaiRes.json();

    // Log key facts for debugging without leaking the full payload
    console.log(
      `[openai-proxy] endpoint=${endpoint} status=${openaiRes.status} ` +
      `elapsed=${elapsedMs}ms model=${payload.model || "?"} ` +
      `finish_reason=${openaiData.choices?.[0]?.finish_reason || "?"}`
    );

    // Return whatever OpenAI returned, with the same status code, so the frontend
    // can distinguish OpenAI errors (4xx/5xx with error body) from proxy errors.
    return new Response(
      JSON.stringify(openaiData),
      {
        status: openaiRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    await logError({
      functionName: "openai-proxy",
      errorType: "INTERNAL",
      errorMessage: (err as Error).message,
    });
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
