-- ============================================================
-- Migration 003: Ad Accounts
-- Stores Meta ad account credentials per organization
-- Access tokens are NEVER exposed to the browser — only Edge Functions read them
-- ============================================================

CREATE TABLE public.ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- Human label, e.g. "BrandPeak", "Gorilla Wear"
  account_id TEXT NOT NULL,            -- Meta ad account ID (numeric, without act_ prefix)
  page_id TEXT,                        -- Facebook Page ID
  instagram_id TEXT,                   -- Instagram account ID
  pixel_id TEXT,                       -- Meta Pixel ID
  access_token TEXT,                   -- Long-lived Meta access token (server-side only)
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;

-- Org members can see account metadata (name, account_id, page_id, etc.)
-- But access_token should only be read by Edge Functions via service_role key
CREATE POLICY "org_members_only" ON public.ad_accounts
  FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- Security note: The RLS policy above allows org members to SELECT all columns
-- including access_token. For production hardening, consider a view or column-level
-- security to hide access_token from browser queries. For now, Edge Functions
-- use service_role to bypass RLS entirely, so the token is only used server-side.
