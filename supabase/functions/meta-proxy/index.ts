import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, getAccessToken } from "../_shared/supabase.ts";

const META_BASE = "https://graph.facebook.com/v22.0/";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getUser(req);

    const { account_id, method, path, body } = await req.json();

    if (!account_id || !path) {
      return new Response(
        JSON.stringify({ error: "account_id and path are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getAccessToken(account_id);

    let res: Response;

    if (method === "GET") {
      const sep = path.includes("?") ? "&" : "?";
      res = await fetch(
        `${META_BASE}${path}${sep}access_token=${encodeURIComponent(accessToken)}`
      );
    } else {
      // POST — form-urlencoded (Meta's expected format)
      const formData = new URLSearchParams();
      formData.append("access_token", accessToken);
      if (body) {
        for (const [key, value] of Object.entries(body)) {
          if (value === null || value === undefined) continue;
          formData.append(
            key,
            typeof value === "object" ? JSON.stringify(value) : String(value)
          );
        }
      }
      res = await fetch(`${META_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });
    }

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
