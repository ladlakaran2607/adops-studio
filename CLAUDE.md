# AdOps Studio — CLAUDE.md

> Multi-tenant SaaS for Meta Ads agencies. React frontend + Supabase backend (shared with Meta Ads Analysis Tool).

---

## Tech Stack

| Layer | Tech | Notes |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite (SWC) | Port 8081 in dev |
| UI | Tailwind CSS + shadcn/ui (Radix) | DO NOT edit `src/components/ui/` |
| Server state | TanStack React Query v5 | All Supabase CRUD + caching |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) | Project: `mgymatqmuspzkxaqnyrp` (shared with Analysis Tool) |
| Meta API | `meta-proxy` edge function only | Access token NEVER exposed to browser |
| AI / LLM | Claude (Anthropic API) via `ai-bulk-edit` edge function | ANTHROPIC_API_KEY as Supabase secret |
| Image/Video | Cloudinary (signed upload via `cloudinary-sign` edge function) | AI Gen Fill + Face Crop for story variants |
| Doc parsing | Mammoth.js | .docx → text |

**Do NOT** migrate to Next.js, use Zustand for data fetching, call Meta API from browser, expose access tokens, make `onAuthStateChange` async, or use the old repo at `/Users/karanladla/Downloads/BrandPeak/Meta Ads Uploader Tool/`.

---

## Shared Database

This app shares a Supabase project with the Meta Ads Analysis Tool. Key conventions:
- **Table names:** PascalCase (e.g., `"Campaign"`, `"AdSet"`, `"AdAccounts"`)
- **Column names:** camelCase (e.g., `"tenantId"`, `"campaignName"`, `"platformAccountId"`)
- **Other team uses Prisma ORM** — they may revoke Supabase role permissions. Fix with GRANT statements.
- **Signup, settings, members, invites** are handled by the main app — NOT this app.
- **Access tokens** live in `"platformCredentials"` (tenant-level), not per-account.

### Table Mapping

| Purpose | Table | Key Columns |
|---|---|---|
| Organizations | `"Tenant"` | `id`, `tenantName`, `createdAt` |
| Members | `"User"` | `supabaseUserId`, `tenantId`, `userType` |
| Ad Accounts | `"AdAccounts"` | `platformAccountId`, `platformAccountName`, `tenantId`, `pageId`, `instagramId`, `pixelId` |
| Credentials | `"platformCredentials"` | `tenantId`, `platform`, `accessToken` (RLS: service_role only) |
| Campaigns | `"Campaign"` | `tenantId`, `campaignId`, `campaignName`, `objective`, `status` |
| Ad Sets | `"AdSet"` | `campaignId`, `adSetId`, `adSetName`, `optimizationGoal`, `status` |
| Ads | `"Ad"` | `adSetId`, `adId`, `adName`, `adCopies`, `titles`, `status` |
| Templates | `"CampaignTemplates"`, `"AdsetTemplates"`, `"AdTemplates"`, `"AdvantageCreativeTemplates"`, `"AiEnhancementRules"` | `tenantId`, camelCase fields |
| Media Cache | `"MediaCache"` | `tenantId`, `cloudinaryUrl`, `metaMediaId` |
| Error Logs | `"ErrorLogs"` | `tenantId`, `functionName`, `errorMessage` |

RLS pattern: `"tenantId" IN (SELECT "tenantId" FROM "User" WHERE "supabaseUserId" = auth.uid()::text)`

---

## Architecture — How Meta API Calls Work

All Meta API calls flow through a single pattern:

```
Frontend code (campaignService / pages / hooks)
  → metaApi.ts: metaPost() / metaGet()
    → invokeEdgeFunction('meta-proxy', { account_id, method, path, body })
      → meta-proxy edge function (attaches access token server-side)
        → Meta Graph API v22.0
```

**Access token flow in edge functions:**
```
getAccessToken(accountId)
  → "AdAccounts" by platformAccountId → get tenantId
  → "platformCredentials" by tenantId + platform='facebook' → get accessToken
```

**Key files:**
- `src/lib/metaApi.ts` — `metaPost()` / `metaGet()` wrappers
- `src/lib/edgeFunctions.ts` — `invokeEdgeFunction()` with JWT refresh
- `src/lib/campaignService.ts` — **ALL campaign launch logic** — builds params, orchestrates campaign → ad set → ad creation
- `supabase/functions/meta-proxy/index.ts` — thin proxy that adds access token + forwards to Meta

---

## Edge Functions — Status

| Function | Status | Called By | Purpose |
|---|---|---|---|
| `meta-proxy` | LIVE | `metaApi.ts` (all Meta calls) | Universal Meta API proxy |
| `meta-fetch-ads` | LIVE | AdsProcessing, BulkUploader | Fetch + normalize ads from Meta |
| `meta-fetch-adsets` | LIVE | BulkUploader | Fetch ad sets from Meta |
| `meta-bulk-duplicate` | LIVE | BulkUploader | Copy ads to ad sets via `/{ad_id}/copies` |
| `ai-bulk-edit` | LIVE | AdsProcessing | Claude API for ad copy suggestions |
| `meta-fetch-leadforms` | LIVE | useLeadForms.ts hook | Fetch lead forms from Meta page |
| `cloudinary-sign` | LIVE | CreativeSection.tsx | Signed Cloudinary upload credentials |

Deploy: `npx supabase functions deploy <name>` (use `--no-verify-jwt` for `meta-proxy`, `cloudinary-sign`)

---

## Data Flows

### Campaign Creation
```
CampaignBuilder.tsx → launchCampaign() [campaignService.ts]
  → metaPost('act_{id}/campaigns', ...) → meta-proxy → Meta API
  → for each ad set: metaPost('act_{id}/adsets', ...) → meta-proxy
  → for each ad: metaPost('act_{id}/ads', ...) → meta-proxy
  → Returns: { meta_campaign_id, ad_sets: [{ status, ads: [{ status }] }] }
```

Creative dispatch in `campaignService.ts`:
| Creative Type | Story? | Multi-text? | Builder |
|---|---|---|---|
| SINGLE_IMAGE | No | No | `buildSimpleImageCreative` → `object_story_spec` |
| SINGLE_IMAGE | Yes or multi-text | — | `buildAssetFeedImageCreative` → `asset_feed_spec` |
| CAROUSEL | No stories | No | `buildSimpleCarouselCreative` → `object_story_spec` |
| CAROUSEL | Any story or multi-text | — | `buildAssetFeedCarouselCreative` → `asset_feed_spec` |
| SINGLE_VIDEO | — | No | `buildSimpleVideoCreative` → `object_story_spec` |
| SINGLE_VIDEO | — | Yes | `buildAssetFeedVideoCreative` → `asset_feed_spec` |

### AI Bulk Edit
```
AdsProcessing.tsx → meta-fetch-ads (fetch) → ai-bulk-edit (Claude suggestions)
  → User accepts → metaPost via meta-proxy (save to Meta)
```

### Bulk Duplication
```
BulkUploader.tsx → meta-fetch-ads + meta-fetch-adsets (fetch both)
  → meta-bulk-duplicate (copy ads × ad sets)
```

### Cloudinary Upload
```
CreativeSection.tsx → cloudinary-sign (get signature)
  → Upload to Cloudinary API → HTTPS URL replaces blob
  → Story variants auto-generated via URL transforms (AI Gen Fill + Face Crop)
```

### Geo Location Search
```
useGeoSearch.ts → metaGet('search?type=adgeolocation&...') → meta-proxy → Meta API
```

---

## Project Structure

```
src/
├── pages/          Login, Templates, CampaignBuilder, AdsProcessing, BulkUploader
├── components/
│   ├── builder/    CreativeSection.tsx, DocumentImport.tsx
│   ├── templates/  TemplateCard, CampaignTemplateForm, AdsetTemplateForm
│   ├── shared/     AccountSelector.tsx (used on 3 pages)
│   └── ui/         49 shadcn primitives (DO NOT EDIT)
├── lib/
│   ├── campaignService.ts   ALL campaign launch logic (orchestrator)
│   ├── metaApi.ts           metaPost/metaGet → meta-proxy
│   ├── edgeFunctions.ts     invokeEdgeFunction() with JWT refresh
│   └── utils.ts             cn() helper
├── hooks/          useAdAccounts, useGeoSearch, useLeadForms, use-toast
├── store/          templateStore.ts (React Query CRUD for 5 template types)
├── contexts/       AuthContext.tsx (user, organizationId, role, signIn/Out)
└── types/          templates.ts

supabase/
├── functions/      7 edge functions (all LIVE)
│   └── _shared/    cors.ts, supabase.ts (getUser, getAccessToken, metaUrl, logError)
└── migrations/     001-009 (009 = shared DB migration)
```

---

## Routes

| Route | Page | Auth |
|---|---|---|
| `/login` | Login | Public |
| `/` | Redirects to `/templates` | Protected |
| `/templates` | Templates (5 types, tabbed) | Protected |
| `/builder` | Campaign Builder | Protected |
| `/ads-processing` | AI Bulk Edit | Protected |
| `/bulk-uploader` | Bulk Duplication | Protected |

---

## Env Variables

**Frontend (.env):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `VITE_CLOUDINARY_CLOUD_NAME`
**Supabase Secrets:** `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

---

## Debugging

**Campaign launch fails?**
1. Browser console → `[Meta POST]` / `[Meta Response]` logs (from metaApi.ts)
2. Browser console → `[Campaign Payload]` / `[Campaign Result]` / `[Campaign Errors]`
3. Supabase Dashboard → Edge Function Logs → `meta-proxy`
4. Supabase → `"ErrorLogs"` table

**Auth fails?** Check `edgeFunctions.ts` token refresh, `AuthContext.tsx` (must be sync), Supabase Auth dashboard.

**Template not loading?** Check `templateStore.ts`, verify tenantId in DB, check RLS policies.

**Meta API error?** Read error message (Meta errors are descriptive), check `campaignService.ts` for the failing step.

---

## Auth Notes

- `onAuthStateChange` callback must be SYNC — set user immediately, fetch membership in background. Async breaks session persistence.
- Signup/org creation is handled by the main app — NOT this app.
- AuthContext queries `"User"` table for `tenantId` and `userType`.
- Currently uses `localStorage` for token storage (dev/testing). For production, switch to cookie storage on `.brandpeak.com` for cross-subdomain SSO.

---

## Deployment & App Integration

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full production deployment guide:
- Two-app architecture (this app + Next.js main app)
- Shared cookie auth (SSO across subdomains)
- DNS setup, hosting, environment variables
- Code changes needed (one file per app)
- Production launch checklist
