-- Multi-salon branding: organizations columns, tenant-scoped templates & commission,
-- salon_settings NOT NULL org, storage bucket for logos.

-- =============================================================================
-- 1) Organizations: branding columns
-- =============================================================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS favicon_url TEXT,
  ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#4B5945',
  ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#0d9488',
  ADD COLUMN IF NOT EXISTS accent_color TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Colombo';

-- =============================================================================
-- 2) notification_templates: organization scope
-- =============================================================================
ALTER TABLE public.notification_templates
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

UPDATE public.notification_templates
SET organization_id = 'a0000000-0000-4000-8000-000000000001'::uuid
WHERE organization_id IS NULL;

ALTER TABLE public.notification_templates
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.notification_templates
  DROP CONSTRAINT IF EXISTS unique_template_type;

DELETE FROM public.notification_templates a
  USING public.notification_templates b
WHERE a.id > b.id
  AND a.organization_id IS NOT DISTINCT FROM b.organization_id
  AND a.type = b.type;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_templates_org_type
  ON public.notification_templates (organization_id, type);

CREATE INDEX IF NOT EXISTS idx_notification_templates_organization_id
  ON public.notification_templates (organization_id);

-- Replace global template policies with org-scoped policies
DROP POLICY IF EXISTS "All can view templates" ON public.notification_templates;
DROP POLICY IF EXISTS "Owner can manage templates" ON public.notification_templates;

CREATE POLICY "notification_templates_select_same_org"
  ON public.notification_templates FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "notification_templates_insert_mgr"
  ON public.notification_templates FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager')
    )
  );

CREATE POLICY "notification_templates_update_mgr"
  ON public.notification_templates FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager')
    )
  )
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "notification_templates_delete_mgr"
  ON public.notification_templates FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager')
    )
  );

-- =============================================================================
-- 3) commission_settings: organization scope
-- =============================================================================
ALTER TABLE public.commission_settings
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

UPDATE public.commission_settings
SET organization_id = 'a0000000-0000-4000-8000-000000000001'::uuid
WHERE organization_id IS NULL;

DELETE FROM public.commission_settings a
  USING public.commission_settings b
WHERE a.id > b.id
  AND a.organization_id IS NOT DISTINCT FROM b.organization_id
  AND a.role = b.role;

ALTER TABLE public.commission_settings
  ALTER COLUMN organization_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_settings_org_role
  ON public.commission_settings (organization_id, role);

CREATE INDEX IF NOT EXISTS idx_commission_settings_organization_id
  ON public.commission_settings (organization_id);

DROP POLICY IF EXISTS "All can view commission settings" ON public.commission_settings;
DROP POLICY IF EXISTS "Owner can manage commission" ON public.commission_settings;

CREATE POLICY "commission_settings_select_same_org"
  ON public.commission_settings FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "commission_settings_all_owner"
  ON public.commission_settings FOR ALL TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'Owner')
  )
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'Owner')
  );

-- =============================================================================
-- 4) salon_settings: NOT NULL organization_id
-- =============================================================================
UPDATE public.salon_settings
SET organization_id = 'a0000000-0000-4000-8000-000000000001'::uuid
WHERE organization_id IS NULL;

ALTER TABLE public.salon_settings
  ALTER COLUMN organization_id SET NOT NULL;

-- =============================================================================
-- 5) Storage: salon-assets bucket + policies
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'salon-assets',
  'salon-assets',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies on storage.objects (idempotent)
DROP POLICY IF EXISTS "salon_assets_public_read" ON storage.objects;
DROP POLICY IF EXISTS "salon_assets_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "salon_assets_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "salon_assets_authenticated_delete" ON storage.objects;

CREATE POLICY "salon_assets_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'salon-assets');

CREATE POLICY "salon_assets_authenticated_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'salon-assets'
    AND split_part(name, '/', 1) = (
      SELECT organization_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "salon_assets_authenticated_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'salon-assets'
    AND split_part(name, '/', 1) = (
      SELECT organization_id::text FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'salon-assets'
    AND split_part(name, '/', 1) = (
      SELECT organization_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "salon_assets_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'salon-assets'
    AND split_part(name, '/', 1) = (
      SELECT organization_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

COMMENT ON COLUMN public.organizations.display_name IS 'Public-facing salon name shown in dashboard';
COMMENT ON COLUMN public.organizations.logo_url IS 'Public URL for logo (e.g. Supabase Storage)';
