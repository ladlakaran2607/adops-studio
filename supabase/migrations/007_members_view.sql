-- ============================================================
-- Migration 007: Members View with Email
-- Creates a view joining organization_members with auth.users
-- so the browser client can display member emails.
-- ============================================================

CREATE VIEW public.org_members_with_email AS
SELECT
  om.id,
  om.organization_id,
  om.user_id,
  om.role,
  om.created_at,
  u.email
FROM public.organization_members om
JOIN auth.users u ON u.id = om.user_id;

-- security_invoker = on means the view runs with the
-- calling user's permissions, so RLS on organization_members applies.
ALTER VIEW public.org_members_with_email SET (security_invoker = on);
