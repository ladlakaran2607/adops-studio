-- ============================================================
-- Migration 002: Template Tables (all 5 types)
-- Fresh creation with organization_id + RLS from the start
-- ============================================================

-- Campaign Templates
CREATE TABLE public.campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  campaign_objective TEXT,            -- OUTCOME_SALES, OUTCOME_LEADS, etc.
  buying_type TEXT DEFAULT 'AUCTION', -- AUCTION, RESERVED
  bid_strategy TEXT,                  -- LOWEST_COST_WITHOUT_CAP, LOWEST_COST_WITH_BID_CAP, etc.
  advantage_plus_catalog BOOLEAN DEFAULT false,
  advantage_campaign_budget BOOLEAN DEFAULT false,
  campaign_budget_type TEXT,          -- Daily, Lifetime
  campaign_budget_value NUMERIC,
  ab_test BOOLEAN DEFAULT false,
  special_ad_categories TEXT[] DEFAULT '{}',
  spend_cap NUMERIC,
  campaign_status TEXT DEFAULT 'PAUSED', -- PAUSED, ACTIVE
  is_adset_budget_sharing BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.campaign_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_only" ON public.campaign_templates
  FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- Adset Templates
CREATE TABLE public.adset_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  optimization TEXT,
  adset_conversion_location TEXT,
  adset_performance_goals TEXT,
  adset_conversion_event TEXT,
  dynamic_creative BOOLEAN DEFAULT false,
  bid_strategy TEXT,
  bid_amount NUMERIC,
  adset_budget_type TEXT,             -- Daily, Lifetime
  adset_budget_value NUMERIC,
  start_date TEXT,
  set_end_date BOOLEAN DEFAULT false,
  end_date TEXT,
  target_gender TEXT,                 -- All, Male, Female
  target_age TEXT,                    -- e.g. "18-65"
  location_type TEXT,
  location TEXT,
  placements TEXT DEFAULT 'Automatic', -- Automatic, Manual
  placement_options JSONB DEFAULT '{}', -- 22 boolean placement flags
  attribution_setting TEXT,
  promoted_object_type TEXT,
  pixel_id TEXT,
  custom_audiences TEXT,
  excluded_audiences TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.adset_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_only" ON public.adset_templates
  FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- Ad Templates
CREATE TABLE public.ad_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  creative_type TEXT,                 -- SINGLE_IMAGE, SINGLE_VIDEO, CAROUSEL
  call_to_action TEXT,                -- SHOP_NOW, LEARN_MORE, etc.
  url_parameters TEXT,
  conversion_domain TEXT,
  tracking_pixel_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ad_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_only" ON public.ad_templates
  FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- Advantage+ Creative Templates
CREATE TABLE public.advantage_creative_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_enhancements JSONB DEFAULT '{}',    -- 14 boolean toggles
  video_enhancements JSONB DEFAULT '{}',    -- 12 boolean toggles
  carousel_enhancements JSONB DEFAULT '{}', -- 11 boolean toggles
  catalog_enhancements JSONB DEFAULT '{}',  -- 6 boolean toggles
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.advantage_creative_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_only" ON public.advantage_creative_templates
  FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- AI Enhancement Rules
CREATE TABLE public.ai_enhancement_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_type TEXT,
  conditions TEXT,
  actions TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_enhancement_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_only" ON public.ai_enhancement_rules
  FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
