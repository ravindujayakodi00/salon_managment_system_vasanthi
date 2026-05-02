-- =============================================================================
-- Migration: Add organization_id to stylist_unavailability
--
-- This table was created before multi-tenancy was added.
-- Its RLS SELECT policy was USING (true) — completely open, no tenant isolation.
-- Steps:
--   1. Add nullable organization_id column
--   2. Backfill from staff table
--   3. Set NOT NULL
--   4. Add index
--   5. Drop old RLS policies
--   6. Add new direct organization_id RLS policies
-- =============================================================================

-- 1. Add nullable column
ALTER TABLE public.stylist_unavailability
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 2. Backfill from staff
UPDATE public.stylist_unavailability su
SET organization_id = s.organization_id
FROM public.staff s
WHERE su.stylist_id = s.id
  AND su.organization_id IS NULL;

-- 3. Set NOT NULL
ALTER TABLE public.stylist_unavailability
  ALTER COLUMN organization_id SET NOT NULL;

-- 4. Add index
CREATE INDEX IF NOT EXISTS idx_stylist_unavailability_org
  ON public.stylist_unavailability (organization_id);

-- 5. Drop old RLS policies
DROP POLICY IF EXISTS "everyone_view_unavailability" ON public.stylist_unavailability;
DROP POLICY IF EXISTS "stylists_manage_own_unavailability" ON public.stylist_unavailability;

-- 6. New RLS policies
-- SELECT: any authenticated user in same org can view (needed for booking & scheduling)
CREATE POLICY "stylist_unavailability_select_org"
  ON public.stylist_unavailability FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- INSERT/UPDATE/DELETE: stylist can manage their own, owners/managers can manage all in org
CREATE POLICY "stylist_unavailability_mutate_org"
  ON public.stylist_unavailability FOR ALL TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      stylist_id IN (SELECT s.id FROM public.staff s WHERE s.profile_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager'))
    )
  )
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );
