-- ============================================================
-- Migration 005: Media Cache
-- Caches Cloudinary URL → Meta media ID mappings
-- Avoids re-uploading the same image/video to Meta on repeat use
-- ============================================================

CREATE TABLE public.media_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cloudinary_url TEXT NOT NULL,
  meta_media_id TEXT NOT NULL,         -- Image hash or video ID on Meta
  media_type TEXT NOT NULL,            -- Image, Video
  ad_account_id UUID REFERENCES public.ad_accounts(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cloudinary_url, ad_account_id)
);

ALTER TABLE public.media_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_only" ON public.media_cache
  FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
