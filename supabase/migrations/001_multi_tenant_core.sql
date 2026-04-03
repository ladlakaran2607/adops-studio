-- ============================================================
-- Migration 001: Multi-Tenant Core
-- Creates: organizations, organization_members, org_invites
-- Plus: helper function + signup trigger
-- ============================================================

-- ==================== TABLES ====================

-- Organizations (each agency/company is one org)
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Organization Members (links auth.users to organizations)
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Invite Tokens (for inviting new users to an org)
CREATE TABLE public.org_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  role TEXT NOT NULL DEFAULT 'member',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  used_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== RLS POLICIES ====================
-- (added after all tables exist so cross-table references work)

-- Organizations: members can see their own org
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_see_own_org" ON public.organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Organization Members
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_memberships" ON public.organization_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "owners_admins_manage_members" ON public.organization_members
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Org Invites
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_see_invites" ON public.org_invites
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "owners_admins_manage_invites" ON public.org_invites
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ==================== FUNCTIONS & TRIGGERS ====================

-- Helper: get the current user's org_id (for use in app code)
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Trigger: auto-create org + membership on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  org_name TEXT;
  org_slug TEXT;
  new_org_id UUID;
  invite_record RECORD;
BEGIN
  -- Check if user signed up with an invite token
  IF NEW.raw_user_meta_data->>'invite_token' IS NOT NULL THEN
    SELECT * INTO invite_record FROM public.org_invites
    WHERE token = NEW.raw_user_meta_data->>'invite_token'
      AND used_at IS NULL
      AND expires_at > now();

    IF invite_record IS NOT NULL THEN
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (invite_record.organization_id, NEW.id, invite_record.role);

      UPDATE public.org_invites SET used_at = now() WHERE id = invite_record.id;
      RETURN NEW;
    END IF;
  END IF;

  -- No invite: create a brand new organization
  org_name := COALESCE(NEW.raw_user_meta_data->>'org_name', 'My Organization');
  org_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]', '-', 'g'));

  INSERT INTO public.organizations (name, slug)
  VALUES (org_name, org_slug || '-' || substr(gen_random_uuid()::text, 1, 8))
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();
