-- ============================================================
-- Migration 004: Live Data Tables
-- Campaigns, Ad Sets, Ads — represent real Meta API entities
-- Distinct from template tables (templates are reusable configs)
-- ============================================================

-- Campaigns (live Meta campaigns)
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ad_account_id UUID NOT NULL REFERENCES public.ad_accounts(id),
  meta_campaign_id TEXT,               -- Written back after Meta API creation
  name TEXT NOT NULL,
  objective TEXT NOT NULL,             -- OUTCOME_SALES, OUTCOME_LEADS, etc.
  buying_type TEXT DEFAULT 'AUCTION',
  bid_strategy TEXT,
  advantage_campaign_budget BOOLEAN DEFAULT false,
  campaign_budget_type TEXT,           -- Daily, Lifetime
  campaign_budget_value NUMERIC,
  special_ad_categories TEXT[] DEFAULT '{}',
  advantage_plus_catalog BOOLEAN DEFAULT false,
  catalog_id TEXT,
  status TEXT DEFAULT 'NOT STARTED',   -- NOT STARTED, IN PROGRESS, CREATED, FAILED
  meta_status TEXT DEFAULT 'PAUSED',   -- Status on Meta's side: PAUSED, ACTIVE
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_only" ON public.campaigns
  FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- Ad Sets (live Meta ad sets)
CREATE TABLE public.ad_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  meta_adset_id TEXT,
  name TEXT NOT NULL,
  optimization_goal TEXT,              -- OFFSITE_CONVERSIONS, LEAD_GENERATION, REACH, LINK_CLICKS
  conversion_location TEXT,            -- Website, App, Instant Form
  performance_goals TEXT,
  conversion_event TEXT,
  dynamic_creative BOOLEAN DEFAULT false,
  bid_strategy TEXT,
  budget_type TEXT,                    -- Daily, Lifetime
  budget_value NUMERIC,
  start_date DATE,
  set_end_date BOOLEAN DEFAULT false,
  end_date DATE,
  target_gender TEXT,                  -- All, Male, Female
  target_age TEXT,                     -- e.g. "18-65"
  location_type TEXT,
  location TEXT,                       -- Comma-separated location names
  placements TEXT DEFAULT 'Automatic',
  placement_options JSONB DEFAULT '{}', -- 22 boolean placement flags
  attribution_setting TEXT,
  pixel_id TEXT,
  status TEXT DEFAULT 'NOT STARTED',
  meta_status TEXT DEFAULT 'PAUSED',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ad_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_only" ON public.ad_sets
  FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- Ads (live Meta ads)
CREATE TABLE public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ad_set_id UUID NOT NULL REFERENCES public.ad_sets(id) ON DELETE CASCADE,
  meta_ad_id TEXT,
  name TEXT NOT NULL,
  ad_format TEXT,                      -- "Single Image or video - Image", "Single Image or video - Video", "Carousel"
  image_format TEXT,                   -- HASH, URL
  -- Creative fields
  ad_copies TEXT[] DEFAULT '{}',       -- Up to 10 primary text variants
  titles TEXT[] DEFAULT '{}',          -- Up to 10 headline variants
  descriptions TEXT[] DEFAULT '{}',
  url TEXT,
  call_to_action TEXT,                 -- SHOP_NOW, LEARN_MORE, etc.
  ad_destination TEXT,
  url_parameters TEXT,
  lead_form_name TEXT,
  -- Image fields
  square_image_url TEXT,               -- 1080x1080 (Cloudinary URL)
  story_image_url TEXT,                -- 1080x1920 (Cloudinary URL)
  video_url TEXT,
  video_thumbnail_url TEXT,
  -- Carousel (JSONB array of card objects)
  carousel_cards JSONB DEFAULT '[]',
  -- Structure per card: { title, ad_copy, file_url, file_1920_url, url }
  -- Advantage+ Creative
  advantage_creative_config JSONB,
  -- Status
  status TEXT DEFAULT 'NOT STARTED',
  meta_status TEXT DEFAULT 'PAUSED',
  error_message TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_only" ON public.ads
  FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
