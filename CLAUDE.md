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

---

## Features & Value Delivered

### UX/UI Redesign (Stitch Mockup-Matched)

**Global**
- Consistent golden theme matching BrandPeak brand identity
- Inter (body) + Space Grotesk (headings) typography system with antialiased rendering
- Responsive layouts — all pages fill available width on any screen size
- Smooth animations throughout (fadeIn, slideUp, scaleIn transitions)
- Dark toast notifications with color-coded types: green (success), red (error), amber (warning)
- Sticky headers on every page with backdrop blur
- Sidebar with brand identity, 4-page navigation, and golden active-state indicator

**Templates Page**
- 5 organized tabs: Campaigns, Ad Sets, Ads, Advantage+ Creative, Rules
- Golden underline tab bar with count badges
- Template cards with icon, detail pills, and always-visible Edit/Duplicate/Delete actions
- Delete confirmation dialog to prevent accidental deletions
- Slide-over panel (Sheet) for template editing — no page navigation, stay in context
- "New Template" golden gradient button in page header
- Enhanced empty states with illustration and actionable CTA buttons

**Campaign Builder**
- Sticky readiness checklist sidebar — always visible while scrolling, shows completion status (e.g., 5/8 complete) with green/amber indicators per item
- Live campaign summary — shows campaign name, objective, budget, ad set targeting details, and ad creative types updating in real-time as user fills fields
- Start Campaign button in sticky sidebar — disabled until all readiness items are complete, golden gradient with rocket icon
- Collapsible ad sets — click to expand/collapse, shows name + template badge + ad count when collapsed
- Pill toggle selectors for New/Existing (campaign type, ad set type) — replaces radio buttons
- Template create/edit shortcuts (+/pencil icons) on ALL 4 template types (Campaign, Ad Set, Ad, Advantage+) — opens slide-over panel directly from the builder without navigating away
- Full template forms in the slide-over — same forms as the Templates page, not simplified versions
- Collapsible Document Import with "How it works" guide + Additional Instructions textarea (2/3 + 1/3 layout)
- Numbered golden section labels (① Campaign Setup, ② Ad Sets & Ads) with ad set count
- Quick Tip card in sidebar with contextual advice
- Creative section redesign: pill toggle for Image/Video/Carousel with icons, Multi-Variant toggle in a muted container, 9:16 Story enabled badge

**Creative & Media**
- Three creative types supported: Single Image, Single Video, Carousel — switchable via pill toggle
- Cloudinary signed upload for images and videos (API secret never touches browser)
- Automatic 9:16 story variant generation via Cloudinary URL transforms: AI Gen Fill + Face Crop
- Manual story image upload with Cloudinary upload (proper HTTPS URLs, not blob)
- Delete button on individual story variant thumbnails (hover to reveal)
- Multi-Variant toggle: when ON, enables story placement optimization via `asset_feed_spec`
- URL tab for pasting image/video URLs directly (applies on Enter or blur)
- Carousel: add/remove cards, bulk upload multiple images at once, per-card title + URL + image
- Video ads: upload video via Cloudinary or paste URL, thumbnail URL support, blob preview → HTTPS URL
- Video uploaded to Meta media library first (`advideos` endpoint) → `video_id` used in creative spec
- Video creative supports both simple mode (`object_story_spec.video_data`) and multi-text mode (`asset_feed_spec` with `SINGLE_VIDEO` format)
- Multi-text video: multiple headlines/primary texts with platform-specific labels for Facebook and Instagram placement optimization
- Lead generation video ads: `call_to_action.value` includes `lead_gen_form_id` + `link: http://fb.me/`

**Campaign Launch Logic**
- Smart creative dispatch: automatically selects the right Meta API format based on creative type + story variants + text count (10 combinations handled)
- Multi-text without Dynamic Creative: when multi-variant is ON, asset_feed_spec handles multiple headlines/texts via shared adlabels — no Dynamic Creative required. When multi-variant is OFF, auto-enables `is_dynamic_creative: true`
- Advantage+ Creative: maps individual template toggles to Meta API feature keys (`image_touchups`, `text_optimizations`, `image_animation`, etc.)
- CBO ON/OFF handling: budget + bid at correct level (campaign vs ad set), bid_amount passed to both levels when required
- All 4 bid strategies supported: Lowest Cost, Bid Cap, Cost Cap, Minimum ROAS — with bid amount fields shown conditionally
- Targeting automation: `advantage_audience: 0` set by default (Meta v22.0 requirement)
- Lead ad support: lead form ID passed correctly for On Ad conversion, `http://fb.me/` link for lead CTAs
- Location targeting: countries, cities (with radius + distance unit), and regions — all via Meta geo search API
- Attribution spec parsing: `7d_click_1d_view`, `1d_click`, `28d_click_1d_view` etc.
- DSA compliance: `dsa_beneficiary` and `dsa_payor` auto-set from page_id
- Pre-launch validation: all required fields checked, blob URLs blocked, story variants verified, Dynamic Creative constraints enforced
- Partial failure handling: campaign + ad sets created even if some ads fail, errors shown per-item

**Ads Processing (AI Bulk Edit)**
- Redesigned filter card with dark "Load Ads" button and clean filter grid
- Golden-bordered AI Bulk Edit panel with sparkle icon and chevron toggle
- Always-visible AI button (disabled when no ads selected, with helper text)
- Strikethrough + green suggestion diff display per headline/body/description
- Individual item labels: "Body 1", "Body 2", "Headline 1" etc. clearly separated
- Per-field revert button — hover to reveal undo icon, reverts individual suggestion to original
- Per-field edit button — click suggestion text to edit inline
- Collapsible ad cards with collapse toggle per card
- "Collapse unselected", "Collapse all", "Expand all" controls in Select All row
- Fixed dark "Push to Meta" bar at bottom with discard option
- Nudge banner for empty state (shows before and after account selection)
- Colored badges: IMAGE (blue), VIDEO (slate), ACTIVE (green), PAUSED (amber), MODIFIED (amber)

**Bulk Uploader**
- Account selector + "Load Ads & Ad Sets" in sticky header
- 60/40 grid layout matching Stitch mockup
- Campaign name shown per ad (via updated `meta-fetch-ads` edge function with `campaign{id,name}`)
- Search filters: ads by name/ID/headline/campaign, ad sets by name/campaign
- Execution Plan card: shows selected ads, target ad sets, total new entities, and explanation text
- Dark "Duplicate X Ads to Y Ad Sets" button with rocket icon
- Guidance banner with different messages based on state (no account vs account selected vs data loaded)
- Selections auto-cleared after successful duplication

**Infrastructure**
- 8 edge functions deployed (meta-proxy, meta-fetch-ads, meta-fetch-adsets, meta-bulk-duplicate, meta-fetch-leadforms, ai-bulk-edit, cloudinary-sign, meta-validate-token)
- `meta-fetch-ads` updated to return campaign name per ad
- `CampaignTemplates` table extended with `bidAmount` column
- All campaign/adset/ad data saved to Supabase after Meta creation
- Error logging to `ErrorLogs` table
- JWT token refresh with expiry checking
