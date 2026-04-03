import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, createServiceClient, logError } from "../_shared/supabase.ts";

/**
 * AI Bulk Edit — uses OpenAI API to generate ad copy suggestions.
 * Reads the OpenAI API key from platformCredentials (platform='openai', apikey column).
 *
 * Input: {
 *   prompt: "Replace spring break with summer break",
 *   ads: [{ id, headlines, bodies, descriptions }]
 * }
 *
 * Output: {
 *   suggestions: { [ad_id]: { headlines, bodies, descriptions } }
 * }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);

    const { prompt, ads } = await req.json();
    console.log("[INPUT] ai-bulk-edit", JSON.stringify({ prompt, ad_count: ads?.length }));

    if (!prompt || !ads || ads.length === 0) {
      return new Response(
        JSON.stringify({ error: "prompt and ads are required" }),
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

    // Build the message for OpenAI with function calling for structured output
    const systemPrompt = `You are an expert Meta (Facebook/Instagram) ad copy editor.
Given a list of ads with their current text variants (headlines, bodies, descriptions) and the user's instruction, produce modified versions of each ad's text.

Rules:
- Preserve the number of items in each array (same length as input)
- Only modify text that is relevant to the user's instruction
- Keep the same tone and style unless asked to change it
- Return ALL ads, even those with no changes (return original text for unchanged ads)`;

    const tool = {
      type: "function" as const,
      function: {
        name: "edit_ads",
        description: "Returns the modified ad text variants for each ad",
        parameters: {
          type: "object",
          properties: {
            ads: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  headlines: { type: "array", items: { type: "string" } },
                  bodies: { type: "array", items: { type: "string" } },
                  descriptions: { type: "array", items: { type: "string" } },
                },
                required: ["id", "headlines", "bodies", "descriptions"],
              },
            },
          },
          required: ["ads"],
        },
      },
    };

    const userMessage = `User instruction: "${prompt}"

Current ads:
${JSON.stringify(ads, null, 2)}

Apply the user's instruction to these ads and return the modified versions using the edit_ads function.`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        max_tokens: 4096,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "edit_ads" } },
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

    // Extract the function call arguments
    const toolCall = openaiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ error: "Failed to parse OpenAI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    if (!parsed?.ads) {
      return new Response(
        JSON.stringify({ error: "OpenAI response missing ads array" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert array to map keyed by ad id
    const suggestions: Record<string, { headlines: string[]; bodies: string[]; descriptions: string[] }> = {};
    for (const ad of parsed.ads) {
      suggestions[ad.id] = {
        headlines: ad.headlines,
        bodies: ad.bodies,
        descriptions: ad.descriptions,
      };
    }

    console.log(`[OUTPUT] ai-bulk-edit: ${Object.keys(suggestions).length} ads modified`);
    return new Response(
      JSON.stringify({ suggestions }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    await logError({
      functionName: "ai-bulk-edit",
      errorType: "OPENAI",
      errorMessage: (err as Error).message,
    });
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
