-- ============================================================
-- Migration 008: Fix RLS Infinite Recursion
-- The "owners_admins_manage_members" policy on organization_members
-- referenced itself, causing infinite recursion on ALL queries
-- that join organization_members (including other tables' RLS).
-- Fix: use a SECURITY DEFINER function to bypass RLS in the check.
-- ============================================================

-- 1. Create a SECURITY DEFINER function to check admin/owner status
--    (SECURITY DEFINER bypasses RLS, breaking the recursion cycle)
CREATE OR REPLACE FUNCTION public.is_org_owner_or_admin(check_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = check_org_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Drop the recursive policy
DROP POLICY IF EXISTS "owners_admins_manage_members" ON public.organization_members;

-- 3. Recreate it using the SECURITY DEFINER function (no recursion)
CREATE POLICY "owners_admins_manage_members" ON public.organization_members
  FOR ALL
  USING (public.is_org_owner_or_admin(organization_id))
  WITH CHECK (public.is_org_owner_or_admin(organization_id));
