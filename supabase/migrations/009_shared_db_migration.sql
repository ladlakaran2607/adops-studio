-- ══════════════════════════════════════════════════════════════════
-- Migration 009: Switch to shared Supabase project (mgymatqmuspzkxaqnyrp)
-- Run this in the Supabase SQL Editor on the SHARED project.
-- ══════════════════════════════════════════════════════════════════

-- ── Step 1.1: Fix Prisma Permission Issue ──
-- Prisma revokes USAGE from Supabase roles. Restore it.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- ── Step 1.2: Helper Functions for RLS ──
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS TEXT AS $$
  SELECT "tenantId" FROM public."User"
  WHERE "supabaseUserId" = auth.uid()::text LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_tenant_owner(check_tenant_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."User"
    WHERE "supabaseUserId" = auth.uid()::text
      AND "tenantId" = check_tenant_id
      AND "userType" = 'owner'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Step 1.3: RLS on Shared Tables ──
-- NOTE: Coordinate with the other team before running this section.
-- IMPORTANT: All policies use get_user_tenant_id() (SECURITY DEFINER) to avoid
-- infinite recursion — inline subqueries on "User" trigger the User table's own
-- RLS policy, which references itself, causing PostgreSQL error 42P17.

ALTER TABLE public."Tenant" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_access" ON public."Tenant"
  FOR ALL USING ("id" = public.get_user_tenant_id());

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_access" ON public."User"
  FOR ALL USING ("tenantId" = public.get_user_tenant_id());

ALTER TABLE public."AdAccounts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_access" ON public."AdAccounts"
  FOR ALL USING ("tenantId" = public.get_user_tenant_id());

ALTER TABLE public."Campaign" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_access" ON public."Campaign"
  FOR ALL USING ("tenantId" = public.get_user_tenant_id());

ALTER TABLE public."AdSet" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_access" ON public."AdSet"
  FOR ALL USING ("campaignId" IN (
    SELECT c."id" FROM public."Campaign" c
    WHERE c."tenantId" = public.get_user_tenant_id()
  ));

ALTER TABLE public."Ad" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_access" ON public."Ad"
  FOR ALL USING ("adSetId" IN (
    SELECT a."id" FROM public."AdSet" a
    JOIN public."Campaign" c ON a."campaignId" = c."id"
    WHERE c."tenantId" = public.get_user_tenant_id()
  ));

-- platformCredentials: tenant-scoped access
ALTER TABLE public."platformCredentials" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_access" ON public."platformCredentials"
  FOR ALL USING ("tenantId" = public.get_user_tenant_id());

-- ── Step 1.4: Add Columns to Shared Tables ──

-- AdAccounts: per-account metadata
ALTER TABLE public."AdAccounts" ADD COLUMN IF NOT EXISTS "pageId" TEXT;
ALTER TABLE public."AdAccounts" ADD COLUMN IF NOT EXISTS "instagramId" TEXT;
ALTER TABLE public."AdAccounts" ADD COLUMN IF NOT EXISTS "pixelId" TEXT;

-- Campaign: campaign-builder fields
ALTER TABLE public."Campaign" ADD COLUMN IF NOT EXISTS "objective" TEXT;
ALTER TABLE public."Campaign" ADD COLUMN IF NOT EXISTS "buyingType" TEXT DEFAULT 'AUCTION';
ALTER TABLE public."Campaign" ADD COLUMN IF NOT EXISTS "bidStrategy" TEXT;
ALTER TABLE public."Campaign" ADD COLUMN IF NOT EXISTS "advantageCampaignBudget" BOOLEAN DEFAULT false;
ALTER TABLE public."Campaign" ADD COLUMN IF NOT EXISTS "campaignBudgetType" TEXT;
ALTER TABLE public."Campaign" ADD COLUMN IF NOT EXISTS "campaignBudgetValue" NUMERIC;
ALTER TABLE public."Campaign" ADD COLUMN IF NOT EXISTS "specialAdCategories" TEXT[] DEFAULT '{}';
ALTER TABLE public."Campaign" ADD COLUMN IF NOT EXISTS "advantagePlusCatalog" BOOLEAN DEFAULT false;
ALTER TABLE public."Campaign" ADD COLUMN IF NOT EXISTS "catalogId" TEXT;
ALTER TABLE public."Campaign" ADD COLUMN IF NOT EXISTS "adAccountId" TEXT;
ALTER TABLE public."Campaign" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'PENDING';
ALTER TABLE public."Campaign" ADD COLUMN IF NOT EXISTS "metaStatus" TEXT;
ALTER TABLE public."Campaign" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;
ALTER TABLE public."Campaign" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT now();

-- AdSet: targeting/config fields
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "optimizationGoal" TEXT;
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "conversionLocation" TEXT;
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "conversionEvent" TEXT;
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "dynamicCreative" BOOLEAN DEFAULT false;
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "bidStrategy" TEXT;
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "budgetType" TEXT;
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "budgetValue" NUMERIC;
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "placements" TEXT DEFAULT 'Automatic';
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "placementOptions" JSONB DEFAULT '{}';
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "targetGender" TEXT;
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "targetAge" TEXT;
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "locationType" TEXT;
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "pixelId" TEXT;
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "attributionSetting" TEXT;
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "performanceGoals" TEXT;
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "startDate" TEXT;
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "setEndDate" BOOLEAN DEFAULT false;
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "endDate" TEXT;
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'PENDING';
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "metaStatus" TEXT;
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;
ALTER TABLE public."AdSet" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT now();

-- Ad: creative fields
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "adCopies" TEXT[] DEFAULT '{}';
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "titles" TEXT[] DEFAULT '{}';
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "descriptions" TEXT[] DEFAULT '{}';
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "url" TEXT;
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "callToAction" TEXT;
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "adDestination" TEXT;
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "urlParameters" TEXT;
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "leadFormName" TEXT;
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "squareImageUrl" TEXT;
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "storyImageUrl" TEXT;
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "videoThumbnailUrl" TEXT;
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "carouselCards" JSONB DEFAULT '[]';
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "advantageCreativeConfig" JSONB;
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "adFormat" TEXT;
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "imageFormat" TEXT;
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'PENDING';
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "metaStatus" TEXT;
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;
ALTER TABLE public."Ad" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT now();

-- ── Step 1.5: Create AdOps-Only Tables ──

-- CampaignTemplates
CREATE TABLE IF NOT EXISTS public."CampaignTemplates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT NOT NULL REFERENCES public."Tenant"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL DEFAULT '',
  "campaignObjective" TEXT DEFAULT '',
  "buyingType" TEXT DEFAULT 'AUCTION',
  "bidStrategy" TEXT DEFAULT 'LOWEST_COST_WITHOUT_CAP',
  "advantagePlusCatalog" BOOLEAN DEFAULT false,
  "catalogId" TEXT DEFAULT '',
  "advantageCampaignBudget" BOOLEAN DEFAULT false,
  "campaignBudgetType" TEXT DEFAULT 'Daily',
  "campaignBudgetValue" NUMERIC,
  "abTest" BOOLEAN DEFAULT false,
  "specialAdCategories" TEXT[] DEFAULT '{}',
  "spendCap" NUMERIC,
  "campaignStatus" TEXT DEFAULT 'PAUSED',
  "isAdsetBudgetSharing" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public."CampaignTemplates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_access" ON public."CampaignTemplates"
  FOR ALL USING ("tenantId" = public.get_user_tenant_id());

-- AdsetTemplates
CREATE TABLE IF NOT EXISTS public."AdsetTemplates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT NOT NULL REFERENCES public."Tenant"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL DEFAULT '',
  "optimization" TEXT DEFAULT 'Conversions',
  "adsetConversionLocation" TEXT DEFAULT 'Website',
  "adsetPerformanceGoals" TEXT DEFAULT 'Maximize number of conversions',
  "adsetConversionEvent" TEXT DEFAULT 'Purchase',
  "dynamicCreative" BOOLEAN DEFAULT false,
  "bidStrategy" TEXT DEFAULT 'LOWEST_COST_WITHOUT_CAP',
  "bidAmount" NUMERIC,
  "adsetBudgetType" TEXT DEFAULT 'Daily',
  "adsetBudgetValue" NUMERIC,
  "startDate" TEXT DEFAULT '',
  "setEndDate" BOOLEAN DEFAULT false,
  "endDate" TEXT DEFAULT '',
  "targetGender" TEXT DEFAULT 'All',
  "targetAge" TEXT DEFAULT '18-65+',
  "locationType" TEXT DEFAULT 'Flexible',
  "location" TEXT DEFAULT '',
  "placements" TEXT DEFAULT 'Automatic',
  "placementOptions" JSONB DEFAULT '{}',
  "attributionSetting" TEXT DEFAULT '7d_click_1d_view',
  "promotedObjectType" TEXT DEFAULT 'PIXEL',
  "pixelId" TEXT DEFAULT '',
  "customAudiences" TEXT DEFAULT '',
  "excludedAudiences" TEXT DEFAULT '',
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public."AdsetTemplates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_access" ON public."AdsetTemplates"
  FOR ALL USING ("tenantId" = public.get_user_tenant_id());

-- AdTemplates
CREATE TABLE IF NOT EXISTS public."AdTemplates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT NOT NULL REFERENCES public."Tenant"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL DEFAULT '',
  "creativeType" TEXT DEFAULT 'SINGLE_IMAGE',
  "callToAction" TEXT DEFAULT 'SHOP_NOW',
  "urlParameters" TEXT DEFAULT '',
  "conversionDomain" TEXT DEFAULT '',
  "trackingPixelId" TEXT DEFAULT '',
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public."AdTemplates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_access" ON public."AdTemplates"
  FOR ALL USING ("tenantId" = public.get_user_tenant_id());

-- AdvantageCreativeTemplates
CREATE TABLE IF NOT EXISTS public."AdvantageCreativeTemplates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT NOT NULL REFERENCES public."Tenant"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL DEFAULT '',
  "imageEnhancements" JSONB DEFAULT '{}',
  "videoEnhancements" JSONB DEFAULT '{}',
  "carouselEnhancements" JSONB DEFAULT '{}',
  "catalogEnhancements" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public."AdvantageCreativeTemplates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_access" ON public."AdvantageCreativeTemplates"
  FOR ALL USING ("tenantId" = public.get_user_tenant_id());

-- AiEnhancementRules
CREATE TABLE IF NOT EXISTS public."AiEnhancementRules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT NOT NULL REFERENCES public."Tenant"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL DEFAULT '',
  "ruleType" TEXT DEFAULT '',
  "conditions" TEXT DEFAULT '',
  "actions" TEXT DEFAULT '',
  "enabled" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public."AiEnhancementRules" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_access" ON public."AiEnhancementRules"
  FOR ALL USING ("tenantId" = public.get_user_tenant_id());

-- MediaCache
CREATE TABLE IF NOT EXISTS public."MediaCache" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT NOT NULL REFERENCES public."Tenant"("id") ON DELETE CASCADE,
  "adAccountId" TEXT,
  "cloudinaryUrl" TEXT NOT NULL,
  "metaMediaId" TEXT,
  "mediaType" TEXT DEFAULT 'image',
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  UNIQUE ("cloudinaryUrl", "adAccountId")
);

ALTER TABLE public."MediaCache" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_access" ON public."MediaCache"
  FOR ALL USING ("tenantId" = public.get_user_tenant_id());

-- ErrorLogs
CREATE TABLE IF NOT EXISTS public."ErrorLogs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT REFERENCES public."Tenant"("id") ON DELETE SET NULL,
  "functionName" TEXT NOT NULL,
  "errorType" TEXT DEFAULT 'INTERNAL',
  "errorMessage" TEXT NOT NULL,
  "context" JSONB DEFAULT '{}',
  "severity" TEXT DEFAULT 'error',
  "resolved" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public."ErrorLogs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_access" ON public."ErrorLogs"
  FOR ALL USING ("tenantId" = public.get_user_tenant_id());

-- ── Grant permissions on new tables (in case Prisma revokes again) ──
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
