# BrandPeak — Deployment & App Integration Guide

> How to deploy AdOps Studio + Meta Ads Analysis Tool as two apps sharing one backend.

---

## Architecture Overview

```
┌─────────────────────────────┐    ┌─────────────────────────────┐
│  Meta Ads Analysis Tool      │    │  AdOps Studio                │
│  Next.js (separate repo)     │    │  React + Vite (this repo)    │
│  app.brandpeak.com           │    │  studio.brandpeak.com        │
└──────────────┬──────────────┘    └──────────────┬──────────────┘
               │                                   │
               └──────────────┬────────────────────┘
                              ▼
                ┌──────────────────────────┐
                │  Shared Supabase Project  │
                │  mgymatqmuspzkxaqnyrp     │
                │  Auth + DB + Edge Fns     │
                └──────────────────────────┘
```

- Two independent frontends, two separate repos, two separate deploys
- One shared Supabase project (same auth, same database, same edge functions)
- AdOps Studio does NOT need to be Next.js — React + Vite is correct

---

## DNS Setup

Use Cloudflare or Route 53 (or any DNS provider) to point subdomains:

```
app.brandpeak.com       → Vercel Project 1 (Next.js main app)
studio.brandpeak.com    → Vercel Project 2 (Vite static app)
```

Both subdomains must be on the same parent domain (`brandpeak.com`) for shared cookie auth to work.

---

## Deploying AdOps Studio (this app)

### Step 1: Build

```bash
npm run build
# Output: dist/ folder with index.html + bundled JS/CSS
```

### Step 2: Host on Vercel (or Netlify / Cloudflare Pages)

```bash
# Option A: Vercel CLI
npx vercel --prod

# Option B: Connect GitHub repo to Vercel dashboard
# Build command: npm run build
# Output directory: dist
# Framework: Vite
```

### Step 3: Environment Variables (set in hosting platform)

```
VITE_SUPABASE_URL=https://mgymatqmuspzkxaqnyrp.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key from Supabase dashboard>
VITE_SUPABASE_PROJECT_ID=mgymatqmuspzkxaqnyrp
VITE_CLOUDINARY_CLOUD_NAME=<cloudinary cloud name>
```

### Step 4: Custom Domain

In Vercel dashboard: Settings → Domains → Add `studio.brandpeak.com`

---

## Shared Auth (Cookie-based SSO)

### Why cookies instead of localStorage

- localStorage is per-origin — `app.brandpeak.com` and `studio.brandpeak.com` each have isolated storage
- Cookies can be set on `.brandpeak.com` (parent domain) — shared by all subdomains
- Bonus: cookies with proper flags are more secure than localStorage (immune to XSS)

### How it works

```
1. User logs in on app.brandpeak.com
2. Supabase Auth returns JWT (access_token + refresh_token)
3. Token is stored in a cookie on .brandpeak.com
4. User clicks "Open Studio" → new tab opens studio.brandpeak.com
5. Browser automatically sends the .brandpeak.com cookie
6. Studio reads cookie → supabase.auth.getSession() → user is logged in
7. No login screen, no redirect, no token in URL
```

### Code change: AdOps Studio

**File: `src/integrations/supabase/cookieStorage.ts`** (new file)

```typescript
const DOMAIN = '.brandpeak.com';

export const cookieStorage = {
  getItem(key: string) {
    const match = document.cookie.match(new RegExp(`${key}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : null;
  },
  setItem(key: string, value: string) {
    document.cookie = `${key}=${encodeURIComponent(value)}; domain=${DOMAIN}; path=/; secure; samesite=lax; max-age=604800`;
  },
  removeItem(key: string) {
    document.cookie = `${key}=; domain=${DOMAIN}; path=/; max-age=0`;
  },
};
```

**File: `src/integrations/supabase/client.ts`** (one-line change)

```typescript
import { cookieStorage } from './cookieStorage';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: cookieStorage,  // was: localStorage
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

### Code change: Main App (Next.js)

Their Next.js app likely uses `@supabase/ssr`. Add cookie domain config:

```typescript
// In their Supabase client setup
cookieOptions: {
  domain: '.brandpeak.com',   // ← only addition needed
  sameSite: 'lax',
  secure: true,
}
```

### "Open Studio" button in main app

Just a link — no special handoff needed:

```tsx
<a href="https://studio.brandpeak.com" target="_blank">
  Open Studio
</a>
```

---

## What's shared vs separate

| Component | Shared? | Details |
|---|---|---|
| Supabase project | SHARED | Same DB, auth, edge functions |
| Auth users | SHARED | One user account works in both apps |
| Database tables | SHARED | Both apps read/write same tables |
| Edge functions | SHARED | Deployed once to shared Supabase project |
| Frontend code | SEPARATE | Two repos, two builds, two deploys |
| Hosting | SEPARATE | Each app has its own Vercel project |
| Domain | SAME PARENT | `app.` and `studio.` on `brandpeak.com` |

---

## Auth flow — end to end

### What Supabase Auth provides (SDK built-in)

- `supabase.auth.signUp()` — creates user in auth.users table
- `supabase.auth.signInWithPassword()` — validates credentials, returns JWT
- `supabase.auth.getSession()` — reads token from storage (cookie or localStorage)
- `supabase.auth.refreshSession()` — exchanges expired JWT for a new one
- `supabase.auth.onAuthStateChange()` — fires when user logs in/out

### What AuthContext adds (our code, `src/contexts/AuthContext.tsx`)

- On app load: calls `getSession()` → if valid, fetches `tenantId` + `userType` from `"User"` table
- Provides `useAuth()` hook so any component can access `user`, `organizationId`, `role`
- Handles `signIn()` and `signOut()` actions

### What's in the JWT

```json
{
  "sub": "2c504ef8-3340-4d05-b50b-10a5ebd0156e",  // user ID
  "email": "user@agency.com",
  "role": "authenticated",
  "exp": 1712192000,                                // expires in 1 hour
  "iat": 1712188400                                  // issued at
}
```

### What's stored in the cookie

```
Name:    sb-mgymatqmuspzkxaqnyrp-auth-token
Value:   { access_token: "eyJ...", refresh_token: "v1.MbQ...", expires_at: 1712192000 }
Domain:  .brandpeak.com
Secure:  true (HTTPS only)
SameSite: lax (prevents CSRF)
Max-Age: 604800 (7 days)
```

### Request flow

```
Any Supabase call (e.g., supabase.from('Campaign').select('*'))
  │
  ├─ Client reads token from cookie via cookieStorage.getItem()
  ├─ Checks expiry: if < 60 seconds left → refreshSession() first
  ├─ Attaches to request: Authorization: Bearer <jwt>
  │
  ▼
Supabase receives request
  ├─ Validates JWT signature
  ├─ Extracts user ID from token
  ├─ Runs RLS policy: WHERE "tenantId" = get_user_tenant_id()
  └─ Returns only rows belonging to user's tenant
```

---

## Edge Functions (already deployed to shared project)

All 7 edge functions are deployed with `--no-verify-jwt` (they validate auth internally via `getUser(req)`):

```bash
npx supabase functions deploy meta-proxy --no-verify-jwt
npx supabase functions deploy meta-fetch-ads --no-verify-jwt
npx supabase functions deploy meta-fetch-adsets --no-verify-jwt
npx supabase functions deploy meta-bulk-duplicate --no-verify-jwt
npx supabase functions deploy ai-bulk-edit --no-verify-jwt
npx supabase functions deploy meta-fetch-leadforms --no-verify-jwt
npx supabase functions deploy cloudinary-sign --no-verify-jwt
```

Supabase secrets (already set):
```bash
npx supabase secrets set ANTHROPIC_API_KEY=<value>
npx supabase secrets set CLOUDINARY_API_KEY=<value>
npx supabase secrets set CLOUDINARY_API_SECRET=<value>
```

---

## Checklist: Production Launch

### Before deploying
- [ ] Both apps' Supabase clients configured with cookie storage on `.brandpeak.com`
- [ ] DNS records pointing subdomains to hosting platforms
- [ ] SSL certificates active on both subdomains (Vercel handles this automatically)
- [ ] Environment variables set in hosting platform (NOT in .env files)
- [ ] Edge functions deployed to shared Supabase project

### After deploying
- [ ] Test: Log into main app → click "Open Studio" → verify auto-login works
- [ ] Test: Create a campaign in Studio → verify it appears in main app's analysis
- [ ] Test: Log out in either app → verify logged out in both
- [ ] Test: Refresh token expiry → verify auto-refresh works across both apps
- [ ] Verify RLS: User A cannot see User B's data in either app

### Security
- [ ] Cookies set with `secure`, `samesite=lax` flags
- [ ] No access tokens exposed in URLs or localStorage
- [ ] CSP headers configured on hosting platform
- [ ] Edge functions validate auth via `getUser(req)` (not just JWT signature)
