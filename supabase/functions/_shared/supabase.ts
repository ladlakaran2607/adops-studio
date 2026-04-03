import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Creates a Supabase client with the service role key (bypasses RLS).
 * Used inside Edge Functions to read access_token and other protected data.
 */
export function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

/**
 * Verifies the user JWT from the Authorization header and returns the user.
 * Throws if invalid.
 */
export async function getUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Missing Authorization header");

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new Error("Invalid auth token");
  return user;
}

/**
 * Fetches the access token for an ad account (by Meta account_id string).
 * Uses service role to bypass RLS.
 *
 * Flow: AdAccounts (by platformAccountId) → get tenantId → platformCredentials (by tenantId + facebook)
 */
export async function getAccessToken(accountId: string): Promise<string> {
  const supabase = createServiceClient();

  // Step 1: Look up the ad account to get its tenantId
  const { data: adAccount, error: adError } = await supabase
    .from("AdAccounts")
    .select("tenantId")
    .eq("platformAccountId", accountId)
    .limit(1)
    .single();

  if (adError || !adAccount?.tenantId) {
    throw new Error(`No ad account found for platformAccountId ${accountId}`);
  }

  // Step 2: Look up the platform credential for this tenant
  const { data: cred, error: credError } = await supabase
    .from("platformCredentials")
    .select("accessToken")
    .eq("tenantId", adAccount.tenantId)
    .eq("platform", "facebook")
    .limit(1)
    .single();

  if (credError || !cred?.accessToken) {
    throw new Error(`No access token found for tenant ${adAccount.tenantId}`);
  }

  return cred.accessToken;
}

const META_API_VERSION = "v22.0";

export function metaUrl(path: string) {
  return `https://graph.facebook.com/${META_API_VERSION}/${path}`;
}

/**
 * Logs an error to the ErrorLogs table for centralized tracking.
 * Non-blocking — does not throw if the insert fails.
 */
export async function logError(options: {
  functionName: string;
  errorType?: string;
  errorMessage: string;
  tenantId?: string | null;
  context?: Record<string, unknown>;
  severity?: "error" | "warning" | "info";
}) {
  try {
    const supabase = createServiceClient();
    await supabase.from("ErrorLogs").insert({
      functionName: options.functionName,
      errorType: options.errorType || "INTERNAL",
      errorMessage: options.errorMessage,
      tenantId: options.tenantId || null,
      context: options.context || {},
      severity: options.severity || "error",
    });
  } catch {
    // Silently fail — error logging should never break the main flow
    console.error("Failed to log error:", options.errorMessage);
  }
}
