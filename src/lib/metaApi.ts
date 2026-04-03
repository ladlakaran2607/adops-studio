/**
 * Frontend Meta API helper — calls Meta Graph API via the meta-proxy edge function.
 * The proxy attaches the access token server-side so it never touches the browser.
 */
import { invokeEdgeFunction } from './edgeFunctions';

// deno-lint-ignore no-explicit-any
type MetaResponse = Record<string, any>;

export async function metaPost(
  accountId: string,
  path: string,
  body: Record<string, unknown>
): Promise<MetaResponse> {
  console.log(`[Meta POST] ${path}`, body);

  const res = await invokeEdgeFunction<MetaResponse>('meta-proxy', {
    account_id: accountId,
    method: 'POST',
    path,
    body,
  });

  console.log(`[Meta Response] ${path}`, res);

  if (res.error) {
    const msg = res.error.error_user_msg || res.error.message || JSON.stringify(res.error);
    throw new Error(msg);
  }

  return res;
}

export async function metaGet(
  accountId: string,
  path: string
): Promise<MetaResponse> {
  console.log(`[Meta GET] ${path}`);

  const res = await invokeEdgeFunction<MetaResponse>('meta-proxy', {
    account_id: accountId,
    method: 'GET',
    path,
  });

  console.log(`[Meta Response] ${path}`, res);

  if (res.error) {
    const msg = res.error.error_user_msg || res.error.message || JSON.stringify(res.error);
    throw new Error(msg);
  }

  return res;
}
