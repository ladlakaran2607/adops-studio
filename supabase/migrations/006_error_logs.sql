-- Error logs table — centralized error tracking across all Edge Functions.
-- Enables future dashboard, notifications, and debugging.

CREATE TABLE public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  function_name TEXT NOT NULL,           -- e.g. 'meta-create-campaign', 'ai-bulk-edit'
  error_type TEXT NOT NULL DEFAULT 'INTERNAL',  -- META_API, AUTH, VALIDATION, INTERNAL, CLOUDINARY, ANTHROPIC
  error_message TEXT NOT NULL,
  context JSONB DEFAULT '{}',            -- flexible: account_id, ad_id, request payload, etc.
  severity TEXT NOT NULL DEFAULT 'error', -- 'error', 'warning', 'info'
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for dashboard queries (most recent errors first, filter by org/function)
CREATE INDEX idx_error_logs_org_created ON public.error_logs (organization_id, created_at DESC);
CREATE INDEX idx_error_logs_unresolved ON public.error_logs (resolved, created_at DESC) WHERE resolved = false;

-- RLS: org members can view their own org's errors
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_errors" ON public.error_logs
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Edge Functions insert via service role (bypasses RLS), so no INSERT policy needed for users.
-- Admins/owners can mark errors as resolved.
CREATE POLICY "org_admins_update_errors" ON public.error_logs
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
