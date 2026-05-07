-- ══════════════════════════════════════════════════════════════════
-- Migration 010: Add excludedLocation to AdsetTemplates
-- Run on the SHARED Supabase project (mgymatqmuspzkxaqnyrp).
--
-- Stores Meta `excluded_geo_locations` as a JSON-stringified
-- GeoLocationEntry[], same shape as the existing `location` column.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public."AdsetTemplates"
  ADD COLUMN IF NOT EXISTS "excludedLocation" TEXT DEFAULT '';
