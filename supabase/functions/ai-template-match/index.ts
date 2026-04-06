import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, createServiceClient, logError } from "../_shared/supabase.ts";

/**
 * AI Template Match — uses OpenAI API to recommend the best templates for a campaign.
 * Reads the OpenAI API key from platformCredentials (platform='openai', apikey column).
 *
 * Input: {
 *   requirements: "Lead gen campaign for real estate in Delhi, ₹500/day budget, targeting 25-45"
 * }
 *
 * Output: {
 *   recommendations: {
 *     campaign: { id, name, reason } | null,
 *     adset: { id, name, reason } | null,
 *     ad: { id, name, reason } | null,
 *     explanation: string
 *   }
 * }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);

    const { requirements } = await req.json();
    console.log("[INPUT] ai-template-match", JSON.stringify({ requirements }));

    if (!requirements || typeof requirements !== "string" || !requirements.trim()) {
      return new Response(
        JSON.stringify({ error: "requirements is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createServiceClient();

    // Get user's tenantId
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

    const tenantId = userRow.tenantId;

    // Fetch OpenAI API key
    const { data: cred } = await supabase
      .from("platformCredentials")
      .select("apikey")
      .eq("tenantId", tenantId)
      .eq("platform", "openai")
      .limit(1)
      .single();

    const apiKey = cred?.apikey;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not found. Please add it in Settings." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all three template types for this tenant in parallel
    const [campaignRes, adsetRes, adRes] = await Promise.all([
      supabase.from("CampaignTemplates").select("*").eq("tenantId", tenantId).order("createdAt", { ascending: false }),
      supabase.from("AdsetTemplates").select("*").eq("tenantId", tenantId).order("createdAt", { ascending: false }),
      supabase.from("AdTemplates").select("*").eq("tenantId", tenantId).order("createdAt", { ascending: false }),
    ]);

    const campaignTemplates = campaignRes.data || [];
    const adsetTemplates = adsetRes.data || [];
    const adTemplates = adRes.data || [];

    console.log(`[TEMPLATES] campaign: ${campaignTemplates.length}, adset: ${adsetTemplates.length}, ad: ${adTemplates.length}`);

    // If no templates exist at all, return early
    if (campaignTemplates.length === 0 && adsetTemplates.length === 0 && adTemplates.length === 0) {
      return new Response(
        JSON.stringify({
          recommendations: {
            campaign: null,
            adset: null,
            ad: null,
            explanation: "No templates found. Create some templates first, then I can recommend the best ones for your campaign.",
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build a compact representation for the prompt (strip createdAt, tenantId to save tokens)
    const stripMeta = (t: Record<string, unknown>) => {
      const { tenantId: _t, createdAt: _c, ...rest } = t;
      return rest;
    };

    const systemPrompt = `You are an expert Meta (Facebook/Instagram) ads strategist.
Given a user's campaign requirements and a list of available templates, recommend the single best-matching template for each type (Campaign, Ad Set, Ad).

Template types and their key fields:
- Campaign Templates: objective, buyingType, bidStrategy, budgetType, budgetValue, specialAdCategories
- Ad Set Templates: optimization, conversionLocation, conversionEvent, targetGender, targetAge, location, placements, attributionSetting
- Ad Templates: creativeType, callToAction, conversionDomain

Rules:
- Only recommend a template if it's a genuinely good match. If none fit, return null for that type.
- Provide a short reason (1 sentence) for each recommendation explaining why it matches.
- Provide an overall explanation (2-3 sentences) summarizing your recommendation strategy.`;

    const tool = {
      type: "function" as const,
      function: {
        name: "recommend_templates",
        description: "Returns the best matching template IDs with reasons",
        parameters: {
          type: "object",
          properties: {
            campaign: {
              type: ["object", "null"],
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                reason: { type: "string" },
              },
              required: ["id", "name", "reason"],
            },
            adset: {
              type: ["object", "null"],
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                reason: { type: "string" },
              },
              required: ["id", "name", "reason"],
            },
            ad: {
              type: ["object", "null"],
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                reason: { type: "string" },
              },
              required: ["id", "name", "reason"],
            },
            explanation: { type: "string" },
          },
          required: ["campaign", "adset", "ad", "explanation"],
        },
      },
    };

    const userMessage = `User's campaign requirements: "${requirements}"

Available Campaign Templates (${campaignTemplates.length}):
${campaignTemplates.length > 0 ? JSON.stringify(campaignTemplates.map(stripMeta), null, 2) : "None"}

Available Ad Set Templates (${adsetTemplates.length}):
${adsetTemplates.length > 0 ? JSON.stringify(adsetTemplates.map(stripMeta), null, 2) : "None"}

Available Ad Templates (${adTemplates.length}):
${adTemplates.length > 0 ? JSON.stringify(adTemplates.map(stripMeta), null, 2) : "None"}

Recommend the best matching template for each type using the recommend_templates function.`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        max_tokens: 1024,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "recommend_templates" } },
      }),
    });

    const openaiData = await openaiRes.json();
    console.log("[OPENAI RESPONSE] status:", openaiRes.status, "finish_reason:", openaiData.choices?.[0]?.finish_reason);

    if (openaiData.error) {
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${openaiData.error.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toolCall = openaiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ error: "Failed to parse OpenAI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    // Validate that recommended IDs actually exist in the templates
    if (parsed.campaign?.id && !campaignTemplates.find((t: Record<string, unknown>) => t.id === parsed.campaign.id)) {
      parsed.campaign = null;
    }
    if (parsed.adset?.id && !adsetTemplates.find((t: Record<string, unknown>) => t.id === parsed.adset.id)) {
      parsed.adset = null;
    }
    if (parsed.ad?.id && !adTemplates.find((t: Record<string, unknown>) => t.id === parsed.ad.id)) {
      parsed.ad = null;
    }

    console.log(`[OUTPUT] ai-template-match: campaign=${parsed.campaign?.name || 'none'}, adset=${parsed.adset?.name || 'none'}, ad=${parsed.ad?.name || 'none'}`);

    return new Response(
      JSON.stringify({ recommendations: parsed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    await logError({
      functionName: "ai-template-match",
      errorType: "OPENAI",
      errorMessage: (err as Error).message,
    });
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
