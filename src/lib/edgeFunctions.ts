import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Get a valid access token, trying getSession first then refreshSession as fallback.
 */
async function getValidToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.access_token) {
    const expiresAt = session.expires_at ?? 0;
    const now = Math.floor(Date.now() / 1000);
    if (expiresAt - now > 60) {
      return session.access_token;
    }
  }

  // Token missing or about to expire — refresh
  const { data: { session: refreshed }, error } = await supabase.auth.refreshSession();
  if (error || !refreshed?.access_token) {
    console.error('[Auth] Refresh failed:', error?.message);
    throw new Error('Session expired — please log in again');
  }
  return refreshed.access_token;
}

/**
 * Invoke a Supabase Edge Function with direct fetch for reliable JWT forwarding.
 */
export async function invokeEdgeFunction<T = unknown>(
  name: string,
  body: Record<string, unknown>
): Promise<T> {
  const token = await getValidToken();
  const url = `${SUPABASE_URL}/functions/v1/${name}`;

  console.log('[Edge] Calling', name, '— token present:', !!token, '— length:', token.length);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    const detail = errorBody?.error || errorBody?.message || `HTTP ${res.status}`;
    console.error('[Edge] Error:', res.status, detail);
    throw new Error(detail);
  }

  const data = await res.json();

  // Edge functions return { error: "..." } or Meta returns { error: { message, error_user_msg } }
  if (data?.error) {
    const e = data.error;
    const msg = typeof e === 'string' ? e : (e.error_user_msg || e.message || JSON.stringify(e));
    throw new Error(msg);
  }

  return data as T;
}
