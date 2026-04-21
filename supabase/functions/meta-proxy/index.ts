import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getUser, getAccessToken } from "../_shared/supabase.ts";

const META_BASE = "https://graph.facebook.com/v22.0/";

// In-memory page-token cache shared across invocations of the same function
// instance. Keyed by `${account_id}|${page_id}`; TTL = 10 minutes. Cuts the
// /me/accounts chatter when a single ad triggers multiple page-scoped calls
// (collection ad = 5 calls in a row). Page access tokens issued via
// /me/accounts are long-lived, so a 10-min cache is safe.
const PAGE_TOKEN_CACHE = new Map<string, { token: string; expiresAt: number }>();
const PAGE_TOKEN_TTL_MS = 10 * 60 * 1000;

async function resolvePageAccessToken(userToken: string, pageId: string, cacheKey: string): Promise<string> {
  const cached = PAGE_TOKEN_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  let pagesUrl: string | null =
    `${META_BASE}me/accounts?fields=id,access_token&limit=100&access_token=${encodeURIComponent(userToken)}`;

  while (pagesUrl) {
    const res: Response = await fetch(pagesUrl);
    const data: {
      data?: { id: string; access_token: string }[];
      paging?: { next?: string };
      error?: { message: string };
    } = await res.json();

    if (data.error) throw new Error(`Failed to resolve page token: ${data.error.message}`);

    const match = (data.data || []).find((p) => p.id === pageId);
    if (match) {
      PAGE_TOKEN_CACHE.set(cacheKey, { token: match.access_token, expiresAt: Date.now() + PAGE_TOKEN_TTL_MS });
      return match.access_token;
    }
    pagesUrl = data.paging?.next ?? null;
  }

  throw new Error(`Page ${pageId} not found in managed pages — token needs pages_manage_ads permission.`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getUser(req);

    const { account_id, method, path, body, page_id, multipart } = await req.json();

    if (!account_id || !path) {
      return new Response(
        JSON.stringify({ error: "account_id and path are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userToken = await getAccessToken(account_id);
    // When page_id is provided, swap to a Page access token. Required for
    // endpoints that post "as the page itself" — e.g. /{page_id}/photos
    // (unpublished), /{page_id}/canvas_elements, /{page_id}/canvases. Meta
    // rejects these with error 200 ("Unpublished posts must be posted to a
    // page as the page itself") when called with a user token.
    const accessToken = page_id
      ? await resolvePageAccessToken(userToken, String(page_id), `${account_id}|${page_id}`)
      : userToken;

    let res: Response;

    if (method === "GET") {
      const sep = path.includes("?") ? "&" : "?";
      res = await fetch(
        `${META_BASE}${path}${sep}access_token=${encodeURIComponent(accessToken)}`
      );
    } else if (multipart && typeof multipart === "object" && multipart.file_url) {
      // Multipart POST — used by endpoints that only accept file uploads, not
      // form-urlencoded bodies. Meta's /act_{id}/adimages is the main case: it
      // rejects the `url` param (#3 app capability) for non-Meta apps, so we
      // fetch the image server-side and forward the bytes as multipart.
      //
      // Expected body shape: { multipart: { file_url: string, field_name?: string } }
      // Extra non-file fields can be passed in `body` alongside `multipart`.
      const fileRes = await fetch(String(multipart.file_url));
      if (!fileRes.ok) {
        throw new Error(`Failed to fetch multipart source (${fileRes.status}): ${multipart.file_url}`);
      }
      const fileBlob = await fileRes.blob();
      const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
      // Derive a filename from the URL path — Meta uses this as the key in
      // the returned `images: { <filename>: { hash, url } }` response map.
      const urlPath = new URL(String(multipart.file_url)).pathname;
      const filename = urlPath.substring(urlPath.lastIndexOf("/") + 1) || "upload.bin";
      const fieldName = typeof multipart.field_name === "string" ? multipart.field_name : "filename";

      const form = new FormData();
      form.append("access_token", accessToken);
      if (body && typeof body === "object") {
        for (const [key, value] of Object.entries(body)) {
          if (value === null || value === undefined) continue;
          form.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
        }
      }
      form.append(fieldName, new File([fileBlob], filename, { type: contentType }));

      res = await fetch(`${META_BASE}${path}`, { method: "POST", body: form });
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
