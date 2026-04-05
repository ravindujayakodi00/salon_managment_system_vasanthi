-- Fix: services visible across all orgs because old USING(true) policies may still exist.
-- This migration drops ALL existing services policies and recreates org-scoped ones.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'services'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.services', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user in the same org
CREATE POLICY "services_select_org"
  ON public.services FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- INSERT: Owner or Manager in the same org
CREATE POLICY "services_insert_mgr"
  ON public.services FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager')
    )
  );

-- UPDATE: Owner or Manager in the same org
CREATE POLICY "services_update_mgr"
  ON public.services FOR UPDATE TO authenticated
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

-- DELETE: Owner or Manager in the same org
CREATE POLICY "services_delete_mgr"
  ON public.services FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager')
    )
  );
