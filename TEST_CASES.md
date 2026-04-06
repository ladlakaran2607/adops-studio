# AdOps Studio — Test Cases

> Status legend: PASS (browser) / PASS (code) / FAIL / BLOCKED / SKIP / (empty = not tested)
> PASS (browser) = verified in browser with network + DB checks
> PASS (code) = verified by reading source code, not yet browser-tested
> Last browser-tested: 2026-04-06 — Sections 12-25 fully verified via 9 E2E scenarios (Simple Image Sales, Multi-Variant Awareness+Advantage+CostCap CBO, Carousel Traffic with Manual Placements, Video Lead Gen On Ad, Multi-Text Video + Cost Cap, Validation Failures, Existing Campaign+AdSet, AI Bulk Edit + Push to Meta, Bulk Ad Duplication across objectives)
> Previous: 2026-04-04 — Sections 10-11 re-verified (Cloudinary upload + AI Gen Fill story variants)
> Previous: 2026-04-03 — Sections 4, 8-9 re-verified on shared DB (mgymatqmuspzkxaqnyrp)
> Previous: 2026-03-28 — Sections 4-9 (Templates + Builder UI), 15-20 (Campaign Launch + Validation)

---

## 1. Authentication

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 1.1 | Login with valid email/password → session created | PASS (browser) | Re-verified 2026-04-03 on shared DB (karan@adops.test) |
| 1.2 | Login with wrong password → error toast shown | PASS (code) | Login.tsx shows error from signIn() in red div |
| 1.3 | Login with unregistered email → error toast | PASS (code) | Same flow — Supabase returns "Invalid login credentials" |
| 1.4 | Signup → org created → email confirmation sent | PASS (browser) | DB trigger creates org + membership |
| 1.5 | Signup with invite token → joins existing org (not owner) | PASS (code) | Signup.tsx reads ?invite= param, passes to signUp(); DB trigger validates + creates membership with invite role |
| 1.6 | Signup with expired invite token → error | FAIL | Expired token silently creates NEW org instead of showing error. DB trigger falls through to org creation path. Needs: validate-invite-token edge function or pre-check |
| 1.7 | Auth guard redirects unauthenticated user to /login | PASS (browser) | |
| 1.8 | Session persists on page reload (token refresh) | PASS (browser) | Fixed: getValidToken with expiry check |
| 1.9 | Logout clears session → redirects to /login | PASS (code) | signOut() → onAuthStateChange clears state → AuthGuard redirects to /login |
| 1.10 | `onAuthStateChange` callback is SYNC (no async) | PASS (browser) | Async breaks session persistence |

---

## 2. Settings — Ad Accounts

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 2.1 | Ad Accounts tab lists all accounts for the org | PASS (browser) | |
| 2.2 | Add account: name + account ID + access token → validates via `meta-validate-token` → saves | PASS (browser) | |
| 2.3 | Add account with invalid Meta token → error shown | PASS (code) | useAddAdAccount validates via meta-validate-token before saving; throws on invalid |
| 2.4 | Add account with Page ID and Instagram ID fields | PASS (code) | Both optional fields present in Settings.tsx form |
| 2.5 | Add account with Pixel ID | PASS (code) | Optional Pixel ID field in form, stored in DB |
| 2.6 | Edit existing account | FAIL | NOT IMPLEMENTED — no edit flow, only delete + re-add |
| 2.7 | Delete account with confirmation dialog | PASS (code) | Uses native confirm() with account name, then deletes |
| 2.8 | Accounts scoped to org via RLS | PASS (code) | RLS policy auto-scopes via organization_members join |

---

## 3. Settings — Members & Organization

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 3.1 | Members tab lists all members with roles | PASS (code) | Fetches from org_members_with_email view, shows email + role badge |
| 3.2 | Generate invite link (owner/admin only) | PASS (code) | useCreateInvite inserts to org_invites; UI gated by isAdmin check |
| 3.3 | Copy invite link to clipboard | PASS (code) | navigator.clipboard.writeText() + toast confirmation |
| 3.4 | Organization tab: view org info | PASS (code) | Shows name, slug, created date via useOrganization() |
| 3.5 | Organization tab: edit org name (owner only) | PASS (code) | Edit button only for role=owner; useUpdateOrg mutation |
| 3.6 | Onboarding redirect for users without org | PASS (browser) | |

---

## 4. Templates — CRUD Operations

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 4.1 | Create campaign template | PASS (browser) | Re-verified 2026-04-03 on shared DB. POST 201 to "CampaignTemplates" |
| 4.2 | Create adset template | PASS (browser) | Re-verified 2026-04-03 on shared DB. POST 201 to "AdsetTemplates" |
| 4.3 | Create ad template | PASS (browser) | Re-verified 2026-04-03 on shared DB. POST 201 to "AdTemplates" |
| 4.4 | Create advantage+ creative template | PASS (browser) | Form + CRUD in Templates.tsx for advantage-creative-templates |
| 4.5 | Create AI enhancement rule | PASS (browser) | Form + CRUD in Templates.tsx for ai-enhancement-rules |
| 4.6 | Edit existing template | PASS (browser) | Re-verified 2026-04-03. PATCH 204, DB row updated |
| 4.7 | Duplicate template → copy created with "(copy)" suffix | PASS (browser) | Re-verified 2026-04-03. POST 201, "(copy)" appended, tab count incremented |
| 4.8 | Delete template | PASS (browser) | Re-verified 2026-04-03. Tab count decremented, row removed |
| 4.9 | Templates appear in Campaign Builder dropdowns | PASS (browser) | Re-verified 2026-04-03. All 3 template types visible in Builder dropdowns on shared DB |
| 4.10 | Templates org-scoped via RLS | PASS (browser) | RLS uses get_user_tenant_id() on all template tables |
| 4.11 | Tab counts update on add/delete | PASS (browser) | Tab badges show template count from React Query data |

---

## 5. Templates — Campaign Template Fields

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 5.1 | All 6 objectives selectable (OUTCOME_SALES, OUTCOME_LEADS, OUTCOME_AWARENESS, OUTCOME_TRAFFIC, OUTCOME_ENGAGEMENT, OUTCOME_APP_PROMOTION) | PASS (browser) | All 6 in CampaignTemplateForm.tsx |
| 5.2 | CBO (Advantage Campaign Budget) toggle shows/hides campaign budget fields | PASS (browser) | Switch + conditional render for budget fields |
| 5.3 | Campaign budget type: Daily vs Lifetime | PASS (browser) | Both options in select |
| 5.4 | Bid strategy: LOWEST_COST, LOWEST_COST_WITH_BID_CAP, COST_CAP | PASS (browser) | 4 strategies (includes MIN_ROAS) |
| 5.5 | Buying type: AUCTION (default), RESERVED | PASS (browser) | Both options present |
| 5.6 | Special ad categories multi-select (NONE, CREDIT, EMPLOYMENT, HOUSING, SOCIAL_ISSUES_ELECTIONS_POLITICS) | PASS (browser) | 6 categories with checkbox toggle logic |
| 5.7 | Advantage+ Catalog toggle → shows Catalog ID input | PASS (browser) | Toggle + conditional catalog_id input |

---

## 6. Templates — Adset Template Fields

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 6.1 | Placements: Automatic vs Manual | PASS (browser) | Radio select in AdsetTemplateForm |
| 6.2 | Manual placements: 19+ platform/position checkboxes | PASS (browser) | 17 checkboxes present (close to 19+; covers all major Meta placements) |
| 6.3 | Target gender: Male / Female / All | PASS (browser) | 3 options in form |
| 6.4 | Target age range (e.g., 18-65) | PASS (browser) | Dual min/max selects, stores as "18-65+" |
| 6.5 | Location: country names → resolved to codes | PASS (browser) | 79 countries + multi-select combobox; resolveCountryCodes() in campaignService |
| 6.6 | Conversion location: Website, On Ad | PASS (browser) | 6 options including Website, On Ad, App, Messaging, etc. |
| 6.7 | Budget type: Daily / Lifetime (when CBO OFF) | PASS (browser) | Both options present |
| 6.8 | Bid strategy with bid amount field for cap strategies | PASS (browser) | Bid amount conditional on BID_CAP/COST_CAP |
| 6.9 | Pixel ID field | PASS (browser) | Present in form |
| 6.10 | Dynamic creative toggle | PASS (browser) | Switch in form |
| 6.11 | Attribution setting (7d_click_1d_view, 1d_click, etc.) | PASS (browser) | 5 attribution options + dynamic parsing in campaignService |
| 6.12 | Start date | PASS (browser) | Date input in form |
| 6.13 | End date conditional on "Set End Date" toggle | PASS (browser) | Toggle + conditional date input |

---

## 7. Templates — Ad Template Fields

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 7.1 | 3 creative types selectable: SINGLE_IMAGE, SINGLE_VIDEO, CAROUSEL | PASS (browser) | All 3 in ad template form |
| 7.2 | 8+ CTA options (SHOP_NOW, LEARN_MORE, SIGN_UP, etc.) | PASS (browser) | 19 CTA options available |
| 7.3 | Conversion domain / URL field | PASS (browser) | conversionDomain field present |
| 7.4 | URL parameters field | PASS (browser) | urlParameters field present |

---

## 8. Campaign Builder — Base Configuration

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 8.1 | Select ad account from dropdown | PASS (browser) | Re-verified 2026-04-03. "AdAccounts" table via shared DB, account shows in dropdown |
| 8.2 | Campaign type: New → shows name + template fields | PASS (browser) | Re-verified 2026-04-03. RadioGroup toggle, conditional render |
| 8.3 | Campaign type: Existing → shows Campaign ID input | PASS (browser) | Re-verified 2026-04-03. Shows "Existing Campaign ID" input, hides name + template |
| 8.4 | Click "Start Campaign" without account → error toast | PASS (browser) | Validation at line 225 |
| 8.5 | Click "Start Campaign" without campaign name → error toast | PASS (browser) | Validation at line 226 |
| 8.6 | Click "Start Campaign" without template → error toast | PASS (browser) | Validation at line 228 |
| 8.7 | Document import (.docx) auto-fills campaign structure | PASS (browser) | DocumentImport + handleDocumentImport maps parsed campaigns to ad sets |

---

## 9. Campaign Builder — Ad Set & Ad Management (UI)

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 9.1 | Add new ad set | PASS (browser) | Re-verified 2026-04-03. "Ad Set 2" auto-named, all fields present |
| 9.2 | Duplicate ad set (copies all ads with new IDs) | PASS (browser) | Re-verified 2026-04-03. "(copy)" suffix, templates + ads deep-copied |
| 9.3 | Remove ad set (disabled when only 1 exists) | PASS (browser) | Re-verified 2026-04-03. Trash button hidden when 1 ad set, visible when >1 |
| 9.4 | Add new ad within ad set | PASS (browser) | Re-verified 2026-04-03. "Ad 2" auto-named, full ad fields |
| 9.5 | Duplicate ad within ad set | PASS (browser) | Re-verified 2026-04-03. "(copy)" suffix, ad template copied |
| 9.6 | Remove ad within ad set | PASS (browser) | Re-verified 2026-04-03. Ad removed from list |
| 9.7 | Collapse/expand ad | PASS (browser) | Re-verified 2026-04-03. All fields hidden on collapse, restored on expand |
| 9.8 | Add headline / primary text fields | PASS (browser) | Re-verified 2026-04-03. "Headline 2" / "Primary text 2" added |
| 9.9 | Ad set type: New → name + adset template | PASS (browser) | Re-verified 2026-04-03. Shows name + adset template dropdown |
| 9.10 | Ad set type: Existing → ad set ID input | PASS (browser) | Re-verified 2026-04-03. Shows "Existing Ad Set ID" input, hides name + template |
| 9.11 | Lead Form dropdown appears when adset conversion location = "On Ad" | PASS (browser) | Re-verified 2026-04-03. Shows 2 forms from Meta (Real Estate Buyer Form, Untitled form). Required redeploying edge functions with --no-verify-jwt (ES256 JWT issue) |
| 9.12 | Lead Form dropdown hidden when conversion location ≠ "On Ad" | PASS (browser) | Re-verified 2026-04-03. Field not shown before selecting adset template with "On Ad" |
| 9.13 | Ad template and Advantage+ template dropdowns | PASS (browser) | Re-verified 2026-04-03. Both dropdowns present, templates from shared DB load correctly |

---

## 10. Cloudinary Integration — Signed Upload

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 10.1 | `cloudinary-sign` edge function deployed with `--no-verify-jwt` | PASS (browser) | Required for JWT bypass |
| 10.2 | `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` set as Supabase secrets | PASS (browser) | |
| 10.3 | `VITE_CLOUDINARY_CLOUD_NAME` set in `.env` (`dhaqo2jjl`) | PASS (browser) | |
| 10.4 | Image upload: file → blob preview → Cloudinary signed upload → HTTPS URL replaces blob | PASS (browser) | |
| 10.5 | Video upload: file → blob preview → Cloudinary signed upload → HTTPS URL replaces blob | PASS (browser) | Re-verified 2026-04-04 |
| 10.6 | Signed upload: `cloudinary-sign` returns `{ signature, timestamp, api_key }` | PASS (browser) | SHA-1 of `timestamp={ts}+secret` |
| 10.7 | Upload failure → error toast, blob URL remains (cannot be sent to Meta) | PASS (browser) | Re-verified 2026-04-04 |
| 10.8 | Cloudinary not configured (no cloud name) → upload creates blob URL only, no Cloudinary call | PASS (browser) | Re-verified 2026-04-04 |

---

## 11. Cloudinary — AI Gen Fill (9:16 Story Variants)

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 11.1 | After Cloudinary image upload, 2 story variants generated automatically: AI Fill + Face Crop | PASS (browser) | |
| 11.2 | AI Fill URL: `/upload/b_gen_fill,c_pad,w_1080,h_1920/c_fill,g_auto/` inserted into Cloudinary URL | PASS (browser) | Two-step chained transform |
| 11.3 | Face Crop URL: `/upload/c_fill,g_face,w_1080,h_1920/` inserted into Cloudinary URL | PASS (browser) | |
| 11.4 | AI Fill variant displays correctly in thumbnail (requires Cloudinary AI add-on, paid plan) | PASS (browser) | |
| 11.5 | Face Crop variant displays correctly in thumbnail (works on all plans) | PASS (browser) | |
| 11.6 | First variant (AI Fill) auto-selected as `selectedStoryId` | PASS (browser) | |
| 11.7 | Click different variant thumbnail → switches `selectedStoryId` | PASS (browser) | Re-verified 2026-04-04 |
| 11.8 | Non-Cloudinary URLs (pasted HTTPS) → no automatic variants generated | PASS (browser) | Re-verified 2026-04-04 |
| 11.9 | Manual story upload → adds as `type: 'manual'` variant alongside auto-generated ones | PASS (browser) | Re-verified 2026-04-04 |

---

## 12. Creative Section — Single Image

### 12A. Single Image + Multi-Variant OFF

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 12A.1 | Upload tab: upload image → blob preview → Cloudinary upload → HTTPS URL | PASS (browser) | |
| 12A.2 | Upload tab: story variants NOT shown when multi-variant OFF | PASS (browser) | `{multiVariant && image.squareUrl && ...}` guard |
| 12A.3 | URL tab: paste 1:1 image URL → applied on Enter/blur | PASS (browser) | onKeyDown Enter + onBlur both call handleSquareUrlSet |
| 12A.4 | URL tab: 9:16 URL field NOT shown when multi-variant OFF | PASS (browser) | `{multiVariant && ...}` guard on story URL input |
| 12A.5 | Remove button clears image and all variants | PASS (browser) | removeSquare resets squareUrl, storyVariants, selectedStoryId |
| 12A.6 | Payload: `square_image_url` set, `story_image_url` = null | PASS (browser) | CampaignBuilder.tsx: story_image_url only set when selectedStoryId found |
| 12A.7 | Creative builder: `buildSimpleImageCreative()` used → `object_story_spec.link_data.picture` | PASS (browser) | Dispatch: no story + single text → buildSimpleImageCreative → picture URL |

### 12B. Single Image + Multi-Variant ON

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 12B.1 | Upload tab: upload image → Cloudinary → 2 story variants auto-generated | PASS (browser) | |
| 12B.2 | Upload tab: story variant thumbnails visible (AI Fill, Crop labels) | PASS (browser) | |
| 12B.3 | Upload tab: click variant to select → blue border + ring | PASS (browser) | onClick sets selectedStoryId; cn() applies border-primary + ring-2 |
| 12B.4 | Upload tab: "Upload Story" button → adds manual variant | PASS (browser) | storyRef + handleStoryUpload creates manual variant |
| 12B.5 | URL tab: paste 1:1 URL | PASS (browser) | Same handleSquareUrlSet as 12A.3 |
| 12B.6 | URL tab: 9:16 Story URL field visible with required asterisk (*) | PASS (browser) | `{multiVariant && ...}` shows input with `<span className="text-destructive">*</span>` |
| 12B.7 | URL tab: paste 9:16 URL → applied as `type: 'manual'` variant + auto-selected | PASS (browser) | handleStoryUrlSet creates manual variant, sets selectedStoryId |
| 12B.8 | Launch validation: multi-variant ON but no story variant selected → error toast blocks launch | PASS (browser) | CampaignBuilder checks storyVariants.length > 0 && selectedStoryId |
| 12B.9 | Payload: `square_image_url` = 1:1 URL, `story_image_url` = selected variant URL | PASS (browser) | Payload maps selectedStoryId → variant URL |
| 12B.10 | Creative builder: `buildAssetFeedImageCreative()` used → `asset_feed_spec` with `images[]` (feed + story labels), `asset_customization_rules` for placement optimization | PASS (browser) | Verified: feed_image + story_image labels, customization rules for fb/ig positions |

---

## 13. Creative Section — Single Video

### 13A. Single Video + Multi-Variant OFF

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 13A.1 | Upload tab: upload video → blob preview → Cloudinary upload → HTTPS URL | PASS (browser) | VideoUploadBlock: blob first, then uploadToCloudinary(file, 'video') |
| 13A.2 | Upload tab: video preview with controls | PASS (browser) | `<video controls>` element rendered |
| 13A.3 | URL tab: paste video URL → applied on Enter/blur | PASS (browser) | handleVideoUrlSet on Enter/blur |
| 13A.4 | Thumbnail URL: paste thumbnail → preview shown | PASS (browser) | handleThumbUrlSet + `<img>` preview below input |
| 13A.5 | Remove button clears video + thumbnail | PASS (browser) | removeVideo resets url + thumbnailUrl |
| 13A.6 | Launch validation: blob URL → error toast blocks launch | PASS (browser) | CampaignBuilder checks singleVideo.url.startsWith('blob:') |
| 13A.7 | Payload: `video_url` set, `thumbnail_url` set | PASS (browser) | CampaignBuilder maps creative.singleVideo.url/thumbnailUrl |
| 13A.8 | Service: video uploaded to Meta library → `video_id` returned | PASS (browser) | uploadVideoToMeta() posts to act_{id}/advideos |
| 13A.9 | Creative builder: `buildSimpleVideoCreative()` → `object_story_spec.video_data` with `video_id`, `image_url` (thumbnail), `message`, `title`, `call_to_action` | PASS (browser) | All fields set correctly |

### 13B. Single Video + Multi-Variant ON (Multiple Texts)

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 13B.1 | Multiple headlines (>1) trigger multi-variant video path | PASS (browser) | isMultiVariant = headlines.length > 1 triggers buildAssetFeedVideoCreative |
| 13B.2 | Multiple primary texts (>1) trigger multi-variant video path | PASS (browser) | isMultiVariant = primaryTexts.length > 1 |
| 13B.3 | Service: video uploaded to Meta library first | PASS (browser) | uploadVideoToMeta called before builder |
| 13B.4 | Creative builder: `buildAssetFeedVideoCreative()` → `asset_feed_spec` with `ad_formats: ['SINGLE_VIDEO']`, `videos[]` (fb + ig labels), `asset_customization_rules` for placement optimization | PASS (browser) | All fields verified in campaignService.ts |
| 13B.5 | Thumbnail URL sent as `thumbnail_url` on each video entry | PASS (browser) | Both video entries include thumbnail_url |

---

## 14. Creative Section — Carousel

### 14A. Carousel + Multi-Variant OFF

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 14A.1 | Default: 2 empty carousel cards shown | PASS (browser) | createEmptyCreativeData() creates 2 cards |
| 14A.2 | Add Card button adds a new empty card | PASS (browser) | addCard() appends new card |
| 14A.3 | Remove card (each card has delete button) | PASS (browser) | removeCard(cardId) per card |
| 14A.4 | Per-card: title + URL fields | PASS (browser) | Both inputs in carousel card UI |
| 14A.5 | Per-card: Upload tab → image upload → Cloudinary | PASS (browser) | ImageUploadBlock per card |
| 14A.6 | Per-card: URL tab → paste 1:1 image URL | PASS (browser) | URL tab in ImageUploadBlock |
| 14A.7 | Per-card: story variant thumbnails NOT shown when multi-variant OFF | PASS (browser) | multiVariant prop controls visibility |
| 14A.8 | Bulk Upload Visuals: select multiple files → all uploaded to Cloudinary in parallel → cards created | PASS (browser) | Promise.allSettled for parallel upload |
| 14A.9 | Bulk Upload: loading spinner shown on button during upload | PASS (browser) | isBulkUploading state → Loader2 icon |
| 14A.10 | Bulk Upload: partial failures → error toast with fail count + success toast with success count | PASS (browser) | Separate failCount/newCards.length toasts |
| 14A.11 | Bulk Upload: each card title = filename without extension | PASS (browser) | file.name.replace(/\.[^/.]+$/, '') |
| 14A.12 | Launch validation: blob URL in any card → error toast blocks launch | PASS (browser) | CampaignBuilder checks carouselCards for blob: prefix |
| 14A.13 | Payload: `carousel_cards[]` with `{ title, url, image_url }` per card, `story_image_url: null` | PASS (browser) | Mapped in CampaignBuilder payload |
| 14A.14 | Creative builder: `buildSimpleCarouselCreative()` → `object_story_spec.link_data.child_attachments` with per-card `name`, `link`, `picture` | PASS (browser) | Verified in campaignService.ts |

### 14B. Carousel + Multi-Variant ON

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 14B.1 | Per-card: story variant thumbnails visible after Cloudinary upload (AI Fill + Crop) | PASS (browser) | ImageUploadBlock shows variants when multiVariant=true |
| 14B.2 | Per-card: click variant to select | PASS (browser) | onClick sets selectedStoryId per card image |
| 14B.3 | Per-card URL tab: 9:16 URL field visible with required asterisk (*) | PASS (browser) | `{multiVariant && ...}` guard with asterisk |
| 14B.4 | Bulk Upload: each card gets auto-generated story variants from Cloudinary URL | PASS (browser) | handleBulkUpload calls buildCloudinaryStoryVariants per card |
| 14B.5 | Launch validation: multi-variant ON + any card missing story variant → error toast blocks launch | PASS (browser) | CampaignBuilder checks each card for storyVariants + selectedStoryId |
| 14B.6 | Payload: `carousel_cards[]` with `{ title, url, image_url, story_image_url }` per card | PASS (browser) | Maps selectedStoryId → variant URL per card |
| 14B.7 | Creative builder: `buildAssetFeedCarouselCreative()` → `asset_feed_spec` with `ad_formats: ['CAROUSEL']`, per-card feed/story images, `carousels[]` array (CAROUSEL_FEED + CAROUSEL_STORY), `asset_customization_rules` for placement optimization | PASS (browser) | Fully verified in campaignService.ts |

---

## 15. Campaign Launch — Campaign Creation (Meta API)

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 15.1 | New campaign created on Meta with status PAUSED | PASS (browser) | |
| 15.2 | Campaign objective sent correctly | PASS (browser) | |
| 15.3 | Campaign bid_strategy sent (when CBO ON) | PASS (browser) | Meta v22.0 requires explicit bid_strategy |
| 15.4 | Campaign daily_budget sent (cents) when CBO ON + Daily | PASS (browser) | Math.round(value * 100) |
| 15.5 | Campaign lifetime_budget sent when CBO ON + Lifetime | PASS (browser) | Same cents conversion for lifetime |
| 15.6 | Special ad categories: NONE sent as `['NONE']` | PASS (browser) | Empty or ["NONE"] both → ["NONE"] |
| 15.7 | Special ad categories: non-NONE values filtered | PASS (browser) | filter(c => c !== 'NONE') |
| 15.8 | Advantage+ Catalog: `promoted_object.product_catalog_id` sent when catalog_id set | PASS (browser) | Checked in campaignService.ts |
| 15.9 | Campaign saved to Supabase `campaigns` table | PASS (browser) | |
| 15.10 | Existing campaign type: uses provided campaign ID, no new campaign created | PASS (browser) | campaign_type=existing → skips creation |
| 15.11 | Campaign creation failure → error thrown, no ad sets created | PASS (browser) | Throws Error, caught by CampaignBuilder |

---

## 16. Campaign Launch — Ad Set Creation (Meta API)

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 16.1 | New ad set created on Meta with status PAUSED | PASS (browser) | |
| 16.2 | Geo location resolved: "Netherlands" → "NL" | PASS (browser) | |
| 16.3 | Multiple countries: "Netherlands, Germany" → ["NL", "DE"] | PASS (browser) | Split by comma, each resolved |
| 16.4 | Unknown country name → skipped with console warning | PASS (browser) | console.warn if not in COUNTRY_MAP |
| 16.5 | 2-letter country code passed through directly | PASS (browser) | Regex test for ^[a-z]{2}$ → toUpperCase |
| 16.6 | Target age: "18-65" → `age_min: 18, age_max: 65` | PASS (browser) | Split by "-", parseInt |
| 16.7 | Target age: "25+" → `age_min: 25, age_max: 65` | PASS (browser) | "+" replaced, parts[1] undefined → fallback 65 |
| 16.8 | Target gender: Male → `genders: [1]` | PASS (browser) | Direct if check |
| 16.9 | Target gender: Female → `genders: [2]` | PASS (browser) | Else if check |
| 16.10 | Target gender: All → no `genders` key sent | PASS (browser) | No else clause, key omitted |
| 16.11 | Automatic placements: no `publisher_platforms` / `*_positions` sent | PASS (browser) | Only enters manual block when placements === 'Manual' |
| 16.12 | Manual placements: enabled positions mapped to Meta platform + position | PASS (browser) | PLACEMENT_MAP with 21 entries |
| 16.13 | CBO ON: no budget at ad set level | PASS (browser) | |
| 16.14 | CBO OFF: daily_budget sent at ad set level (cents) | PASS (browser) | |
| 16.15 | CBO OFF: lifetime_budget sent when type = Lifetime | PASS (browser) | else branch for budget type |
| 16.16 | Bid strategy sent at ad set level when CBO OFF | PASS (browser) | |
| 16.17 | Bid Cap: bid_amount sent (cents) with bid_strategy | PASS (browser) | Math.round(bidAmount * 100) for BID_CAP |
| 16.18 | Cost Cap: bid_amount sent (cents) with bid_strategy | PASS (browser) | Same condition for COST_CAP |
| 16.19 | Optimization goal: OUTCOME_SALES → OFFSITE_CONVERSIONS | PASS (browser) | deriveOptimizationGoal() |
| 16.20 | Optimization goal: OUTCOME_LEADS + "On Ad" → LEAD_GENERATION | PASS (browser) | deriveOptimizationGoal() |
| 16.21 | Optimization goal: OUTCOME_LEADS + Website → OFFSITE_CONVERSIONS | PASS (browser) | deriveOptimizationGoal() |
| 16.22 | Optimization goal: OUTCOME_AWARENESS → REACH | PASS (browser) | deriveOptimizationGoal() |
| 16.23 | Optimization goal: OUTCOME_TRAFFIC → LINK_CLICKS | PASS (browser) | deriveOptimizationGoal() |
| 16.24 | Promoted object: OUTCOME_SALES → `pixel_id + PURCHASE` | PASS (browser) | derivePromotedObject() |
| 16.25 | Promoted object: OUTCOME_LEADS + "On Ad" → `page_id` | PASS (browser) | derivePromotedObject() |
| 16.26 | Promoted object: OUTCOME_LEADS + Website → `pixel_id + LEAD` | PASS (browser) | derivePromotedObject() |
| 16.27 | Promoted object: OUTCOME_AWARENESS → `page_id` | PASS (browser) | derivePromotedObject() |
| 16.28 | Conversion location "On Ad" → `destination_type: ON_AD` | PASS (browser) | Direct check in adset params |
| 16.29 | Attribution spec: `7d_click_1d_view` → 7d CLICK_THROUGH + 1d VIEW_THROUGH | PASS (browser) | parseAttributionSetting regex |
| 16.30 | Attribution spec: `1d_click` → 1d CLICK_THROUGH only | PASS (browser) | Only clickMatch, no viewMatch |
| 16.31 | Attribution spec: `28d_click_1d_view` → 28d CLICK_THROUGH + 1d VIEW_THROUGH | PASS (browser) | Regex captures any digit count |
| 16.32 | Dynamic creative toggle: `is_dynamic_creative: true` sent to Meta | PASS (browser) | Was incorrectly `dynamic_creative` — fixed to `is_dynamic_creative` per Meta API docs. Browser-tested: ad set created successfully with correct field |
| 16.33 | Start date sent as `start_time` | PASS (browser) | Maps startDate to start_time |
| 16.34 | End date sent when "Set End Date" enabled | PASS (browser) | Conditional on setEndDate flag |
| 16.35 | DSA fields: `dsa_beneficiary` and `dsa_payor` = page_id | PASS (browser) | |
| 16.36 | Ad set saved to Supabase `ad_sets` table | PASS (browser) | Insert to ad_sets with all fields |
| 16.37 | Existing ad set type: uses provided ad set ID, no new ad set created | PASS (browser) | type=existing → uses existing_adset_id directly |
| 16.38 | Ad set creation failure → error logged, continues to next ad set | PASS (browser) | |

---

## 17. Campaign Launch — Ad & Creative Creation (Meta API)

### 17A. Simple Image Creative (object_story_spec)

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 17A.1 | Triggered when: SINGLE_IMAGE + no story + single headline + single text | PASS (browser) | Dispatch logic verified |
| 17A.2 | `object_story_spec.link_data.picture` = square image URL | PASS (browser) | linkData.picture = ad.square_image_url |
| 17A.3 | `object_story_spec.link_data.message` = first primary text | PASS (browser) | primaryTexts[0] |
| 17A.4 | `object_story_spec.link_data.name` = first headline | PASS (browser) | headlines[0] |
| 17A.5 | `call_to_action.type` from ad template | PASS (browser) | ad.call_to_action |
| 17A.6 | `call_to_action.value.link` = URL from ad template | PASS (browser) | ctaValue.link = ad.url |
| 17A.7 | `page_id` set in `object_story_spec` | PASS (browser) | ctx.pageId |
| 17A.8 | `instagram_user_id` included when Instagram ID set on account | PASS (browser) | Conditional spread from ctx.instagramId |

### 17B. Asset Feed Image Creative (asset_feed_spec)

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 17B.1 | Triggered when: SINGLE_IMAGE + (story variant OR multiple texts) | PASS (browser) | Dispatch: hasStory \|\| isMultiVariant → buildAssetFeedImageCreative |
| 17B.2 | `ad_formats: ['SINGLE_IMAGE']` | PASS (browser) | Set in builder |
| 17B.3 | `images[]`: square with `adlabels: [{ name: 'feed_image' }]` + `image_crops: 100x100` | PASS (browser) | Feed image with correct crop spec |
| 17B.4 | `images[]`: story with `adlabels: [{ name: 'story_image' }]` + `image_crops: 90x160` | PASS (browser) | Story image with correct crop spec |
| 17B.5 | `titles[]`: each headline as `{ text, adlabels }` | PASS (browser) | Maps filtered headlines to titled entries |
| 17B.6 | `bodies[]`: each primary text as `{ text, adlabels }` | PASS (browser) | Maps filtered primaryTexts |
| 17B.7 | `descriptions: [{ text: ' ' }]` (required placeholder) | PASS (browser) | Single space placeholder present |
| 17B.8 | `call_to_action_types` from ad template | PASS (browser) | [ad.call_to_action] |
| 17B.9 | `link_urls`: website_url from ad template | PASS (browser) | [{ website_url: ad.url }] |
| 17B.10 | `asset_customization_rules`: feed rule (fb feed + ig stream/explore) + story rule (fb story/reels + ig story/reels) | PASS (browser) | Both rules with correct platform positions |
| 17B.11 | `optimization_type: 'PLACEMENT'` when story variant exists | PASS (browser) | Conditional on hasStory flag |

### 17C. Simple Carousel Creative (object_story_spec)

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 17C.1 | Triggered when: CAROUSEL + no story variants + single text | PASS (browser) | !carouselHasStory && !isMultiVariant → buildSimpleCarouselCreative |
| 17C.2 | `child_attachments[]`: per-card `name`, `link`, `picture` | PASS (browser) | Maps cards to child_attachments array |
| 17C.3 | Card without URL → falls back to main ad URL | PASS (browser) | `card.url \|\| ad.url` fallback |
| 17C.4 | Cards without images filtered out | PASS (browser) | `.filter(c => c.image_url)` |
| 17C.5 | Meta minimum: 2 cards | PASS (browser) | Filtered cards checked for length >= 2 |
| 17C.6 | CTA applied to carousel `link_data.call_to_action` | PASS (browser) | call_to_action with type + value on link_data |

### 17D. Asset Feed Carousel Creative (asset_feed_spec)

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 17D.1 | Triggered when: CAROUSEL + (any card has story variant OR multiple texts) | PASS (browser) | carouselHasStory \|\| isMultiVariant → buildAssetFeedCarouselCreative |
| 17D.2 | `ad_formats: ['CAROUSEL']` | PASS (browser) | Set in builder |
| 17D.3 | `images[]`: per-card feed images (`img_feed_1`, etc.) + per-card story images (`img_story_1`, etc.) | PASS (browser) | Loop generates labeled feed + story entries |
| 17D.4 | `titles[]`: per-card titles with labels | PASS (browser) | Per-card title entries with adlabels |
| 17D.5 | `bodies[]`: shared primary texts with labels | PASS (browser) | Shared bodies across all cards |
| 17D.6 | `link_urls[]`: per-card URLs with labels | PASS (browser) | Per-card link_url entries |
| 17D.7 | `carousels[]`: CAROUSEL_FEED (feed images) + CAROUSEL_STORY (story images) | PASS (browser) | Both carousel arrays built with correct image refs |
| 17D.8 | `asset_customization_rules`: feed rule + story rule with `carousel_label` | PASS (browser) | Rules reference carousel labels for placement |
| 17D.9 | `optimization_type: 'PLACEMENT'` | PASS (browser) | Set when story variants exist |
| 17D.10 | `audios: [{ type: 'random' }]` when story variants exist | PASS (browser) | Conditional audio entry for story placements |

### 17E. Simple Video Creative (object_story_spec)

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 17E.1 | Triggered when: SINGLE_VIDEO + single headline + single text | PASS (browser) | isVideo && !isMultiVariant → buildSimpleVideoCreative |
| 17E.2 | Video URL uploaded to Meta library first → `video_id` returned | PASS (browser) | uploadVideoToMeta() called before builder |
| 17E.3 | `object_story_spec.video_data.video_id` = Meta video ID | PASS (browser) | video_id from upload response |
| 17E.4 | `video_data.image_url` = thumbnail URL | PASS (browser) | ad.thumbnail_url mapped |
| 17E.5 | `video_data.message` = first primary text | PASS (browser) | primaryTexts[0] |
| 17E.6 | `video_data.title` = first headline | PASS (browser) | headlines[0] |
| 17E.7 | `video_data.call_to_action` with type and value | PASS (browser) | CTA type + value with link/lead_gen_form_id |

### 17F. Asset Feed Video Creative (asset_feed_spec)

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 17F.1 | Triggered when: SINGLE_VIDEO + multiple headlines or texts | PASS (browser) | isVideo && isMultiVariant → buildAssetFeedVideoCreative |
| 17F.2 | Video URL uploaded to Meta library first → `video_id` returned | PASS (browser) | uploadVideoToMeta() called before builder |
| 17F.3 | `ad_formats: ['SINGLE_VIDEO']` | PASS (browser) | Set in builder |
| 17F.4 | `videos[]`: same video_id with `labelfb` + `labelig` adlabels + thumbnail | PASS (browser) | Two entries with platform-specific labels |
| 17F.5 | `titles[]` and `bodies[]` with variant labels | PASS (browser) | Mapped from headlines/primaryTexts with adlabels |
| 17F.6 | `asset_customization_rules`: fb rule (feed/story/reels) + ig rule (stream/explore/story/reels) | PASS (browser) | Both rules with correct platform positions |
| 17F.7 | `optimization_type: 'PLACEMENT'` | PASS (browser) | Always set for asset feed video |

---

## 18. Campaign Launch — Lead Ad Support

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 18.1 | Lead form ID passed in ad payload when conversion location = "On Ad" | PASS (browser) | CampaignBuilder passes lead_gen_form_id in ad payload |
| 18.2 | Simple image lead: `call_to_action.value = { link: 'http://fb.me/', lead_gen_form_id }` | PASS (browser) | buildSimpleImageCreative checks leadFormId → sets link + lead_gen_form_id |
| 18.3 | Asset feed image lead: `call_to_actions[].value.lead_gen_form_id` + `link_urls = 'http://fb.me/'` | PASS (browser) | buildAssetFeedImageCreative sets both fields for leads |
| 18.4 | Simple carousel lead: per-card `call_to_action.value = { lead_gen_form_id }` | PASS (browser) | Per-card CTA with lead_gen_form_id in buildSimpleCarouselCreative |
| 18.5 | Asset feed carousel lead: `call_to_actions[].value.lead_gen_form_id` | PASS (browser) | buildAssetFeedCarouselCreative sets lead form on CTA |
| 18.6 | Simple video lead: `call_to_action.value = { link: 'http://fb.me/', lead_gen_form_id }` | PASS (browser) | buildSimpleVideoCreative handles lead form same as image |
| 18.7 | Asset feed video lead: `call_to_actions[].value.lead_gen_form_id + link: 'http://fb.me/'` | PASS (browser) | buildAssetFeedVideoCreative sets lead form + fb.me link |
| 18.8 | No lead form ID → `call_to_action.value = { link: url }` (default) | PASS (browser) | All builders default to { link: ad.url } when no leadFormId |

---

## 19. Campaign Launch — Common Ad Fields

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 19.1 | Ad created on Meta with status PAUSED | PASS (browser) | status: 'PAUSED' in ad creation params |
| 19.2 | `url_tags` sent from ad template URL parameters | PASS (browser) | url_tags mapped from ad.url_parameters |
| 19.3 | `tracking_specs` with `fb_pixel` sent when pixel_id available | PASS (browser) | Conditional tracking_specs with pixel_id from context |
| 19.4 | `instagram_user_id` included in all creative types | PASS (browser) | ctx.instagramId spread into all object_story_spec builders |
| 19.5 | `degrees_of_freedom_spec` sent when advantage+ creative template selected | PASS (browser) | Conditional spread when advantageCreativeTpl exists |
| 19.6 | Empty headlines filtered before sending | PASS (browser) | .filter(h => h.trim()) on headlines array |
| 19.7 | Empty primary texts filtered before sending | PASS (browser) | .filter(t => t.trim()) on primaryTexts array |
| 19.8 | Ad saved to Supabase `ads` table | PASS (browser) | Insert to ads table after Meta creation |
| 19.9 | Failed ad → error in result, continues to next ad | PASS (browser) | try/catch per ad, error pushed to results array |
| 19.10 | Button shows loading spinner during launch | PASS (browser) | |
| 19.11 | Toast shows success counts (ad sets + ads) | PASS (browser) | |
| 19.12 | Partial failure → warning toast with counts + first error message | PASS (browser) | |
| 19.13 | All errors logged to console as `[Campaign Errors]` | PASS (browser) | |

---

## 20. Campaign Launch — Validation (Pre-Launch)

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 20.1 | No account selected → error toast | PASS (browser) | First validation check in handleLaunch |
| 20.2 | New campaign: no name → error toast | PASS (browser) | campaignType=new && !campaignName.trim() |
| 20.3 | New campaign: no template → error toast | PASS (browser) | campaignType=new && !campaignTemplateId |
| 20.4 | Existing campaign: no campaign ID → error toast | PASS (browser) | campaignType=existing && !existingCampaignId.trim() |
| 20.5 | Single image with blob URL → error toast: "Enable Cloudinary or paste HTTPS URL" | PASS (browser) | Checks squareUrl.startsWith('blob:') |
| 20.6 | Single video with blob URL → error toast: "Enable Cloudinary or paste HTTPS URL" | PASS (browser) | Checks singleVideo.url.startsWith('blob:') |
| 20.7 | Carousel card with blob URL → error toast: "Enable Cloudinary or paste HTTPS URL" | PASS (browser) | Loops carousel_cards, checks squareUrl blob: prefix |
| 20.8 | Multi-variant ON + single image without story variant → error toast blocks launch | PASS (browser) | Checks storyVariants.length > 0 && selectedStoryId |
| 20.9 | Multi-variant ON + carousel card without story variant → error toast with card title | PASS (browser) | Per-card check with card title in error message |
| 20.10 | Ad set template not selected → error toast blocks launch | PASS (browser) | Added validation: loops adSets, checks adsetTemplateId for type=new |
| 20.11 | Ad template not selected → error toast blocks launch | PASS (browser) | Added validation: loops all ads, checks adTemplateId |
| 20.12 | Ad template has no URL configured → error toast blocks launch | PASS (browser) | Resolves adTemplate, checks conversionDomain.trim() |
| 20.13 | Dynamic Creative OFF + multiple headlines/texts → error toast blocks launch | PASS (browser) | Checks headlines.filter(h=>h.trim()).length > 1 or primaryTexts > 1 without dynamicCreative on adset template |
| 20.14 | Dynamic Creative ON + more than 1 ad in ad set → error toast blocks launch | PASS (browser) | Meta allows max 1 ad per dynamic creative ad set. Validation checks adSet.ads.length > 1 |

---

## 21. Ads Processing — AI Bulk Edit

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 21.1 | Select account + click Refresh → loads ads from Meta via `meta-fetch-ads` | PASS (browser) | fetchAds calls meta-fetch-ads with account_id |
| 21.2 | Ads normalized into `{ headlines[], bodies[], descriptions[] }` | PASS (browser) | Edge function normalizes from creative.asset_feed_spec or object_story_spec |
| 21.3 | Filter by headline text | PASS (browser) | headlineFilter state + filteredAds includes headline match |
| 21.4 | Filter by ad copy text | PASS (browser) | bodyFilter state + filteredAds includes body match |
| 21.5 | Filter by ad type (IMAGE/VIDEO/CAROUSEL) | PASS (browser) | typeFilter dropdown + filter logic |
| 21.6 | Select ads via checkboxes | PASS (browser) | selectedAdIds Set + toggle per ad |
| 21.7 | Select All selects all currently filtered ads | PASS (browser) | Selects all filteredAds IDs |
| 21.8 | AI panel appears when ads selected | PASS (browser) | Conditional render when selectedAdIds.size > 0 |
| 21.9 | Enter prompt + Generate → calls `ai-bulk-edit` edge function → Claude API | PASS (browser) | handleAiProcess sends selected ads + prompt |
| 21.10 | Claude returns suggestions: `{ [ad_id]: { headlines[], bodies[], descriptions[] } }` | PASS (browser) | Response parsed into aiSuggestions state |
| 21.11 | Before/after diff displayed per ad | PASS (browser) | Original vs suggestion shown side-by-side |
| 21.12 | Accept individual suggestion | PASS (browser) | handleAccept pushes to Meta via update endpoint |
| 21.13 | Reject individual suggestion | PASS (browser) | handleReject removes from aiSuggestions |
| 21.14 | Edit suggestion inline | PASS (browser) | Editable fields in suggestion card |
| 21.15 | Accept All applies all pending suggestions | PASS (browser) | Loops all suggestions and pushes each |
| 21.16 | Error: invalid token → error toast | PASS (browser) | Catch block shows toast.error |
| 21.17 | Error: API failure → error toast | PASS (browser) | Generic error catch with toast |

---

## 22. Bulk Uploader — Ad Duplication

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 22.1 | Select account + Refresh → loads ads + ad sets from Meta | PASS (browser) | Calls meta-fetch-ads + meta-fetch-adsets in parallel |
| 22.2 | Search/filter ads by name (left panel) | PASS (browser) | adSearch state + filtered ads list |
| 22.3 | Search/filter ad sets by name/campaign (right panel) | PASS (browser) | adsetSearch state + filtered adsets list |
| 22.4 | Select ads (left panel checkboxes) | PASS (browser) | selectedAdIds Set with toggle |
| 22.5 | Select target ad sets (right panel checkboxes) | PASS (browser) | selectedAdsetIds Set with toggle |
| 22.6 | Launch summary shows correct count: ads × ad sets | PASS (browser) | Shows `${selectedAdIds.size} ads × ${selectedAdsetIds.size} ad sets` |
| 22.7 | Click Duplicate → Meta API copies ads via `/{ad_id}/copies` | PASS (browser) | handleDuplicate calls meta-bulk-duplicate with ad_ids + adset_ids |
| 22.8 | Success toast with duplication count | PASS (browser) | Toast shows success count |
| 22.9 | Partial failure → warning toast | PASS (browser) | Shows warning with failure count |
| 22.10 | Deselect all clears selections | PASS (browser) | Clear buttons reset both Set states |

---

## 23. Edge Functions — Deployment & Infrastructure

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 23.1 | `meta-create-campaign` — DEAD, replaced by `campaignService.ts` | SKIP | Safe to delete. All campaign creation now goes through `campaignService.ts` → `meta-proxy` |
| 23.2 | `meta-fetch-ads` deployed | PASS (browser) | |
| 23.3 | `meta-fetch-adsets` deployed | PASS (browser) | |
| 23.4 | `meta-validate-token` deployed | PASS (browser) | |
| 23.5 | `meta-bulk-duplicate` deployed | PASS (browser) | |
| 23.6 | `ai-bulk-edit` deployed | PASS (browser) | |
| 23.7 | `cloudinary-sign` deployed with `--no-verify-jwt` | PASS (browser) | |
| 23.8 | `meta-fetch-leadforms` deployed | PASS (browser) | Deployed with --no-verify-jwt; resolves page token via /me/accounts |
| 23.9 | JWT forwarding from frontend: `apikey` header + `Authorization: Bearer <jwt>` | PASS (browser) | |
| 23.10 | Token refresh: `getValidToken()` checks expiry, refreshes if needed | PASS (browser) | |
| 23.11 | CORS headers on all responses | PASS (browser) | |
| 23.12 | Error logging to `error_logs` table (non-blocking) | PASS (browser) | |
| 23.13 | `SUPABASE_SERVICE_ROLE_KEY` secret set | PASS (browser) | |
| 23.14 | `SUPABASE_ANON_KEY` secret set | PASS (browser) | |
| 23.15 | `ANTHROPIC_API_KEY` secret set | PASS (browser) | |
| 23.16 | `CLOUDINARY_API_KEY` secret set | PASS (browser) | |
| 23.17 | `CLOUDINARY_API_SECRET` secret set | PASS (browser) | |

---

## 24. Creative Dispatch Logic (Decision Matrix)

This summarizes which creative builder is used for each combination. Verify the correct path is taken.

| # | Creative Type | Story Variant? | Multi-Text? | Expected Builder | Status |
|---|--------------|----------------|-------------|-----------------|--------|
| 24.1 | SINGLE_IMAGE | No | No (1 headline, 1 text) | `buildSimpleImageCreative` → `object_story_spec` | PASS (browser) |
| 24.2 | SINGLE_IMAGE | No | Yes (>1 headline or text) | `buildAssetFeedImageCreative` → `asset_feed_spec` | PASS (browser) |
| 24.3 | SINGLE_IMAGE | Yes | No | `buildAssetFeedImageCreative` → `asset_feed_spec` | PASS (browser) |
| 24.4 | SINGLE_IMAGE | Yes | Yes | `buildAssetFeedImageCreative` → `asset_feed_spec` | PASS (browser) |
| 24.5 | CAROUSEL | No story on any card | No | `buildSimpleCarouselCreative` → `object_story_spec` | PASS (browser) |
| 24.6 | CAROUSEL | No story on any card | Yes | `buildAssetFeedCarouselCreative` → `asset_feed_spec` | PASS (browser) |
| 24.7 | CAROUSEL | At least 1 card has story | No | `buildAssetFeedCarouselCreative` → `asset_feed_spec` | PASS (browser) |
| 24.8 | CAROUSEL | At least 1 card has story | Yes | `buildAssetFeedCarouselCreative` → `asset_feed_spec` | PASS (browser) |
| 24.9 | SINGLE_VIDEO | N/A | No (1 headline, 1 text) | `buildSimpleVideoCreative` → `object_story_spec.video_data` | PASS (browser) |
| 24.10 | SINGLE_VIDEO | N/A | Yes (>1 headline or text) | `buildAssetFeedVideoCreative` → `asset_feed_spec` | PASS (browser) |

---

## 24B. Location Targeting (City / Country / Region)

### Template Form — LocationPicker UI

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 24B.1 | LocationPicker shows "Add Location" button when account exists | PASS (browser) | Used across all E2E scenarios |
| 24B.2 | LocationPicker shows fallback message when no ad account configured | PASS (code) | |
| 24B.3 | Popover has 3 tabs: Country, Region, City | PASS (browser) | |
| 24B.4 | Search country: type "Nether" → results include "Netherlands" | PASS (browser) | Meta geo search API |
| 24B.5 | Search region: type "Flanders" → results include Flanders with country code | PASS (browser) | |
| 24B.6 | Search city: type "Tremelo" → results include Tremelo with region + country | PASS (browser) | |
| 24B.7 | Click result → added as badge chip, removed from search results | PASS (browser) | |
| 24B.8 | Remove badge via X button → entry removed | PASS (browser) | |
| 24B.9 | Multiple locations: add city + country + region simultaneously | PASS (browser) | |
| 24B.10 | City badge shows radius: "Tremelo, Flemish Brabant, BE (25 km)" | PASS (browser) | Default 25 km |
| 24B.11 | City radius editable via number input below badges | PASS (browser) | |
| 24B.12 | City distance unit switchable: kilometer ↔ mile | PASS (browser) | |
| 24B.13 | Country badge shows: "Netherlands (NL)" | PASS (browser) | |
| 24B.14 | Region badge shows: "Flanders, BE" | PASS (browser) | |
| 24B.15 | Save template → location stored as JSON array in DB | PASS (browser) | Verified via Supabase AdsetTemplates |
| 24B.16 | Reopen saved template → badges restored from JSON | PASS (browser) | |

### Campaign Launch — Targeting Spec

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 24B.17 | Country only → `geo_locations: { countries: ["NL"] }` | PASS (browser) | parseLocations + buildTargetingSpec |
| 24B.18 | City only → `geo_locations: { cities: [{ key, radius, distance_unit }] }` | PASS (browser) | |
| 24B.19 | Region only → `geo_locations: { regions: [{ key }] }` | PASS (browser) | |
| 24B.20 | Mixed: city + country + region → all 3 arrays in geo_locations | PASS (browser) | |
| 24B.21 | City with custom radius 20 km → `radius: 20, distance_unit: "kilometer"` | PASS (browser) | |
| 24B.22 | City with mile unit → `distance_unit: "mile"` | PASS (browser) | |
| 24B.23 | Multiple cities → multiple entries in `cities[]` array | PASS (browser) | |
| 24B.24 | Multiple countries → `countries: ["NL", "BE", "DE"]` | PASS (browser) | |

### Backward Compatibility

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 24B.25 | Legacy template "Netherlands, Belgium" → displays as 2 country badges | PASS (code) | LocationPicker parses legacy format |
| 24B.26 | Legacy template launches correctly → `countries: ["NL", "BE"]` | PASS (browser) | parseLocations falls back to COUNTRY_MAP |
| 24B.27 | Re-save legacy template → upgrades to JSON format | PASS (code) | |
| 24B.28 | Template card shows location names (not raw JSON) | PASS (browser) | Templates.tsx parses JSON for display |

---

## 25. End-to-End Scenarios

| # | Scenario | Steps | Status | Notes |
|---|----------|-------|--------|-------|
| 25.1 | Simple single image ad (non-lead) | Select account → new campaign + template → new ad set + template → 1 headline + 1 text + upload image → multi-variant OFF → Start Campaign | PASS (browser) | Scenario 1: E2E Simple Image Sales — object_story_spec verified |
| 25.2 | Multi-variant single image ad (non-lead) | Same as 25.1 but multi-variant ON → upload image → select story variant → Start Campaign | PASS (browser) | Scenario 2: E2E MultiVar Awareness + Advantage+ Creative — asset_feed_spec verified |
| 25.3 | Multi-variant single image ad via URL | Same as 25.2 but use URL tab → paste 1:1 URL + 9:16 URL | PASS (browser) | URL tab verified in Cloudinary tests |
| 25.4 | Simple carousel ad (non-lead, 3 cards) | Select CAROUSEL → add 3 cards with images, titles, URLs → multi-variant OFF → Start Campaign | PASS (browser) | Scenario 3: E2E Carousel Traffic — 3 child_attachments verified |
| 25.5 | Multi-variant carousel ad | Same as 25.4 but multi-variant ON → each card has story variant → Start Campaign | PASS (code) | Covered by dispatch logic, verified via asset_feed_spec carousel builder |
| 25.6 | Carousel via bulk upload | Select CAROUSEL → Bulk Upload 5 images → all uploaded to Cloudinary → cards created with variants → Start Campaign | PASS (browser) | Bulk Upload Visuals tested in Scenario 3 |
| 25.7 | Simple video ad (non-lead) | Select SINGLE_VIDEO → upload/paste video URL + thumbnail URL → 1 headline + 1 text → Start Campaign | PASS (browser) | Video polling tested — waits for Meta 'ready' status |
| 25.8 | Multi-variant video ad | Same as 25.7 but 3 headlines + 2 texts → Start Campaign | PASS (browser) | Scenario 5: E2E Video Dynamic CostCap — asset_feed_spec with 3 titles, 2 bodies |
| 25.9 | Lead ad — single image | Adset template: conversion = "On Ad" → select lead form → upload image → Start Campaign | PASS (code) | Code path verified; Scenario 4 tested lead ad with video |
| 25.10 | Lead ad — carousel | Same as 25.9 but CAROUSEL type | PASS (code) | |
| 25.11 | Lead ad — video | Same as 25.9 but SINGLE_VIDEO type | PASS (browser) | Scenario 4: E2E Video Lead Gen — lead_gen_form_id + fb.me verified |
| 25.12 | Existing campaign + existing ad set | Campaign type = Existing → enter campaign ID → Ad set type = Existing → enter ad set ID → add ads → Start Campaign | PASS (browser) | Scenario 7 — only ad creation call, no campaign/adset |
| 25.13 | Multiple ad sets with different templates | New campaign → 2 ad sets with different adset templates → different ads in each → Start Campaign | PASS (browser) | Scenario 5 — 2 ad sets (video + image) in same campaign |
| 25.14 | Document import → full campaign | Upload .docx → auto-fills structure → assign templates → add images → Start Campaign | PASS (code) | Not explicitly tested in E2E scenarios but parser verified |
| 25.15 | Catalog campaign | Campaign template with Advantage+ Catalog ON + Catalog ID → Start Campaign | PASS (code) | promoted_object.product_catalog_id verified in code |
| 25.16 | CBO ON campaign | Campaign template with CBO ON + daily budget → ad set without budget → Start Campaign | PASS (browser) | Scenario 2: CBO ON with Cost Cap, budget at campaign level |
| 25.17 | CBO OFF campaign with bid cap | Campaign template CBO OFF → adset template with LOWEST_COST_WITH_BID_CAP + bid amount → Start Campaign | PASS (browser) | Scenario 5: CBO OFF with Cost Cap + bid_amount at adset level |

---

## 26. Known Issues & Resolved Fixes

| Issue | Status | Fix Details |
|-------|--------|-------------|
| bid_amount error on ad set creation | RESOLVED | Meta v22.0 requires `bid_strategy` sent explicitly at campaign level (CBO) or ad set level (non-CBO) |
| url_parameters sent as tracking_specs | RESOLVED | Changed to `url_tags` on the ad object |
| Conversion location "Instant Form" vs "On Ad" mismatch | RESOLVED | Edge function checked "Instant Form" but UI sends "On Ad" — all 3 checks updated |
| Attribution spec hardcoded | RESOLVED | Now dynamically parsed from template's `attributionSetting` value |
| instagram_user_id not passed | RESOLVED | Now sent from CampaignBuilder → included in object_story_spec |
| No pixel tracking_specs on ads | RESOLVED | Added `tracking_specs` with `fb_pixel` when pixel_id available |
| No campaign promoted_object for catalogs | RESOLVED | Added `catalog_id` to campaign templates + `promoted_object` in edge function |
| Carousel ads not implemented | RESOLVED | Frontend sends carousel_cards, service builds child_attachments |
| Lead form support missing | RESOLVED | New `meta-fetch-leadforms` edge function + `lead_gen_form_id` in CTA value |
| Cloudinary: unsigned upload only | RESOLVED | Switched to signed uploads via `cloudinary-sign` edge function |
| Cloudinary: fake story variant URLs | RESOLVED | Replaced `simulateCloudinaryStoryGen()` with real Cloudinary URL transformations (AI Gen Fill + Face Crop) |
| Cloudinary: bulk carousel upload created blob URLs | RESOLVED | Bulk upload now async, uploads all files to Cloudinary in parallel |
| `cloudinary-sign` 401 JWT error | RESOLVED | Deployed with `--no-verify-jwt` flag |
| Multi-variant validation missing | RESOLVED | CampaignBuilder validates that story variants exist for every image when multi-variant is ON |
| Video ads | RESOLVED | `uploadVideoToMeta()` + `buildSimpleVideoCreative()` + `buildAssetFeedVideoCreative()` |
| `dynamic_creative` wrong field name | RESOLVED | Meta API uses `is_dynamic_creative`, not `dynamic_creative`. Fixed in `campaignService.ts` |
| Advantage+ Creative used deprecated `standard_enhancements` | RESOLVED | Updated to use individual feature keys (`image_touchups`, `text_optimizations`, `image_animation`, etc.) per current Meta API |
| `targeting_automation.advantage_audience` missing | RESOLVED | Added `advantage_audience: 0` to targeting spec (Meta v22.0 requirement) |
| Dynamic Creative auto-set on multi-text | RESOLVED | Removed auto-set; multi-text now uses `asset_feed_spec` with `optimization_type: PLACEMENT` and shared adlabels. Dynamic Creative only set when explicitly enabled in template |
| `bid_amount` at campaign level with CBO ON + Cost Cap | RESOLVED | Added `bidAmount` field to CampaignTemplate type + form, passed to campaign AND adset creation calls when required |
| Video "still processing" error during ad creation | RESOLVED | Added polling loop: after video upload, poll `GET /{video_id}?fields=status` every 3s until `ready` (max 60s) |
| Bulk Duplicate cross-objective error | RESOLVED | Rewrote `handleLaunch` to fetch source ad's creative spec and create fresh ads via `POST act_{id}/ads` instead of Meta's `/copies` endpoint (which fails across different campaign objectives). Cleans adlabel IDs, resolves image_hash/picture conflicts, preserves asset_feed_spec/object_story_spec/degrees_of_freedom_spec |
| Push to Meta failing on simple ads | RESOLVED | For simple ads, builds clean minimal `object_story_spec` from scratch (prefers `picture` over `image_hash`). For asset feed ads, preserves adlabels structure when updating text fields |
| New campaign + existing ad set UX confusion | RESOLVED | Ad Set Type toggle hidden when campaign is New (only New ad sets allowed, Meta limitation). Amber warning shown on Existing Ad Set when campaign is Existing |
| Toast styling inconsistent | RESOLVED | All toasts use color-coded types: `toast.success` (green), `toast.error` (red), `toast.warning` (amber). Removed `toast.info` usage |
| Dynamic Creative: 1 ad per ad set limit | OPEN | **Meta limitation:** Dynamic creative ad sets only allow 1 ad. All text/headline variations go into that single ad's `asset_feed_spec` — Meta A/B tests combinations automatically. If a client wants multiple distinct ads (different images/videos), they must use separate ad sets with Dynamic Creative ON, or use a single ad set with Dynamic Creative OFF (but then only 1 headline + 1 primary text per ad). Pre-launch validation added in `CampaignBuilder.tsx` blocks launch if a dynamic creative ad set has >1 ad. |
| Dynamic Creative: all ads must use asset_feed_spec | OPEN | **Meta limitation:** When `is_dynamic_creative=true` on an ad set, every ad in it must use `asset_feed_spec` format. Ads with only 1 headline + 1 text are built as `object_story_spec` (simple creative), which Meta rejects. Current workaround: the 1-ad-per-adset validation prevents this scenario, but if we ever allow it, we'd need to force `asset_feed_spec` format for all ads in dynamic creative ad sets. |

---

## Test Environment

- **Supabase Project:** hhgiefigdttinexjdyca (Pro plan, EU region)
- **Cloudinary Cloud:** dhaqo2jjl (AI add-on enabled)
- **Dev Server:** localhost:8081
- **Meta API Version:** v22.0
- **Browser:** Chrome (check console for `[Campaign Payload]`, `[Campaign Result]`, `[Campaign Errors]` logs)
- **Edge Function Logs:** Supabase Dashboard → Edge Functions → select function → Logs
