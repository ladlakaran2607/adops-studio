/**
 * Client-side error logger — writes failed ad operations to the ErrorLogs
 * table in Supabase so they can be debugged from the dashboard without
 * needing the user's browser console.
 *
 * Captures: the error message, the full request body that caused the failure,
 * and which part of the app triggered it (campaignService, adsProcessing,
 * bulkUploader).
 */
import { supabase } from '@/integrations/supabase/client';

interface LogAdErrorOptions {
  /** Which tool / flow triggered the error */
  source: 'campaign-builder' | 'ads-processing' | 'bulk-uploader';
  /** Human-readable label, e.g. the ad name */
  adName: string;
  /** The error message from Meta or internal */
  errorMessage: string;
  /** The full request body sent (or about to be sent) to Meta */
  requestBody?: Record<string, unknown> | null;
  /** Any extra context (ad ID, ad set ID, etc.) */
  extra?: Record<string, unknown>;
}

/**
 * Fire-and-forget — never throws, never blocks the caller.
 * Failures to log are silently swallowed (we don't want logging errors
 * to mask the actual ad creation error).
 */
export function logAdError(opts: LogAdErrorOptions): void {
  const context: Record<string, unknown> = {};
  if (opts.requestBody) context.requestBody = opts.requestBody;
  if (opts.extra) Object.assign(context, opts.extra);

  // Resolve tenantId from the current session (best-effort)
  supabase.auth.getUser().then(({ data }) => {
    const userId = data?.user?.id;

    // Look up tenantId from User table
    const tenantPromise = userId
      ? supabase
          .from('User')
          .select('tenantId')
          .eq('supabaseUserId', userId)
          .single()
          .then(r => r.data?.tenantId as string | null)
      : Promise.resolve(null);

    tenantPromise.then(tenantId => {
      supabase.from('ErrorLogs').insert({
        functionName: opts.source,
        errorType: 'META_API',
        errorMessage: `[${opts.adName}] ${opts.errorMessage}`,
        tenantId: tenantId || null,
        context,
        severity: 'error',
      }).then(({ error }) => {
        if (error) console.warn('[ErrorLogger] Failed to write to ErrorLogs:', error.message);
        else console.log(`[ErrorLogger] Logged error for "${opts.adName}" to ErrorLogs`);
      });
    });
  }).catch(() => {
    // Silently swallow — logging should never break the app
  });
}
