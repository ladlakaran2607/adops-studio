/**
 * Build-time feature flags read from Vite env vars.
 * All flags default to false (production-safe). Enable per-environment by
 * setting the corresponding VITE_* var in .env / .env.local.
 */

/**
 * When true, CreativeSection exposes a "URL" tab alongside "Upload" so a
 * developer can paste an existing HTTPS URL instead of uploading a file.
 * Kept OFF in production — the agency workflow is upload-only.
 */
export const CREATIVE_URL_INPUT_ENABLED =
  import.meta.env.VITE_ENABLE_CREATIVE_URL_INPUT === 'true';
