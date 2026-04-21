/**
 * Frontend Meta API helper — calls Meta Graph API via the meta-proxy edge function.
 * The proxy attaches the access token server-side so it never touches the browser.
 */
import { invokeEdgeFunction } from './edgeFunctions';

// deno-lint-ignore no-explicit-any
type MetaResponse = Record<string, any>;

export interface MetaCallOptions {
  /** When set, meta-proxy swaps the tenant's user token for this page's
   *  access token before calling Meta. Required for endpoints that post
   *  "as the page itself" — e.g. `{page_id}/photos` (unpublished),
   *  `{page_id}/canvas_elements`, `{page_id}/canvases`. */
  pageId?: string;
  /** When set, meta-proxy fetches the given URL server-side and forwards
   *  the bytes as multipart/form-data. Used for `/act_{id}/adimages` which
   *  rejects the `url` param for non-Meta apps.
   *  - `fileUrl`: HTTPS source to fetch.
   *  - `fieldName`: multipart form field name (defaults to `filename`). */
  multipart?: { fileUrl: string; fieldName?: string };
}

export async function metaPost(
  accountId: string,
  path: string,
  body: Record<string, unknown>,
  options?: MetaCallOptions,
): Promise<MetaResponse> {
  console.log(
    `[Meta POST] ${path}`,
    body,
    options?.pageId ? `(as page ${options.pageId})` : '',
    options?.multipart ? `(multipart: ${options.multipart.fileUrl})` : '',
  );

  const res = await invokeEdgeFunction<MetaResponse>('meta-proxy', {
    account_id: accountId,
    method: 'POST',
    path,
    body,
    ...(options?.pageId ? { page_id: options.pageId } : {}),
    ...(options?.multipart
      ? { multipart: { file_url: options.multipart.fileUrl, field_name: options.multipart.fieldName } }
      : {}),
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
  path: string,
  options?: MetaCallOptions,
): Promise<MetaResponse> {
  console.log(`[Meta GET] ${path}`, options?.pageId ? `(as page ${options.pageId})` : '');

  const res = await invokeEdgeFunction<MetaResponse>('meta-proxy', {
    account_id: accountId,
    method: 'GET',
    path,
    ...(options?.pageId ? { page_id: options.pageId } : {}),
  });

  console.log(`[Meta Response] ${path}`, res);

  if (res.error) {
    const msg = res.error.error_user_msg || res.error.message || JSON.stringify(res.error);
    throw new Error(msg);
  }

  return res;
}
