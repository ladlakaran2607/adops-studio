-- ============================================================
-- Migration 009: Add catalog_id to campaign_templates
-- Needed for Advantage+ Catalog campaigns (promoted_object)
-- ============================================================

ALTER TABLE public.campaign_templates ADD COLUMN catalog_id TEXT;
