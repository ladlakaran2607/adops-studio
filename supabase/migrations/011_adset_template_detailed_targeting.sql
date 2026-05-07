-- ══════════════════════════════════════════════════════════════════
-- Migration 011: Add detailed targeting columns to AdsetTemplates
-- Run on the SHARED Supabase project (mgymatqmuspzkxaqnyrp).
--
-- Stores Meta detailed targeting (interests / behaviors / demographics)
-- for both inclusion and exclusion as JSON-stringified
-- DetailedTargetingEntry[].
--
-- Inclusion → targeting.flexible_spec[0].{interests,behaviors,demographics}
-- Exclusion → targeting.exclusions.{interests,behaviors,demographics}
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public."AdsetTemplates"
  ADD COLUMN IF NOT EXISTS "detailedTargeting" TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "excludedDetailedTargeting" TEXT DEFAULT '';
