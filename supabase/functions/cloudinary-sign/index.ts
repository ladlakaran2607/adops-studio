import { corsHeaders } from '../_shared/cors.ts';
import { getUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate — only logged-in users can request upload signatures
    await getUser(req);

    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY');

    if (!apiSecret || !apiKey) {
      return new Response(
        JSON.stringify({ error: 'Cloudinary credentials not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);

    // Cloudinary signing: SHA-1("timestamp={ts}" + api_secret)
    const stringToSign = `timestamp=${timestamp}${apiSecret}`;
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-1', encoder.encode(stringToSign));
    const signature = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return new Response(
      JSON.stringify({ signature, timestamp, api_key: apiKey }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
