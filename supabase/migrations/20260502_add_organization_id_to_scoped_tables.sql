-- =============================================================================
-- Migration: Add organization_id to 5 tables that previously scoped via staff FK
--
-- Tables: staff_earnings, staff_salary_advances, salary_settings,
--         stylist_breaks, stylist_availability
--
-- Steps for each table:
--   1. Add nullable organization_id column
--   2. Backfill from staff table
--   3. Set NOT NULL
--   4. Update unique constraints where needed
--   5. Add index
--   6. Drop old JOIN-based RLS policies
--   7. Add new direct organization_id RLS policies
-- =============================================================================


-- =============================================================================
-- 1. staff_earnings
-- =============================================================================

-- 1a. Add nullable column
ALTER TABLE public.staff_earnings
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 1b. Backfill from staff
UPDATE public.staff_earnings se
SET organization_id = s.organization_id
FROM public.staff s
WHERE se.staff_id = s.id
  AND se.organization_id IS NULL;

-- 1c. Set NOT NULL
ALTER TABLE public.staff_earnings
  ALTER COLUMN organization_id SET NOT NULL;

-- 1d. Update unique constraint: UNIQUE(staff_id, date) → UNIQUE(organization_id, staff_id, date)
ALTER TABLE public.staff_earnings
  DROP CONSTRAINT IF EXISTS staff_earnings_staff_id_date_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'staff_earnings'
      AND constraint_name = 'staff_earnings_organization_id_staff_id_date_key'
  ) THEN
    ALTER TABLE public.staff_earnings
      ADD CONSTRAINT staff_earnings_organization_id_staff_id_date_key
      UNIQUE (organization_id, staff_id, date);
  END IF;
END $$;

-- 1e. Add index
CREATE INDEX IF NOT EXISTS idx_staff_earnings_org
  ON public.staff_earnings (organization_id);

-- 1f. Drop old RLS policies (staff JOIN-based)
DROP POLICY IF EXISTS "staff_earnings_select_org" ON public.staff_earnings;
DROP POLICY IF EXISTS "staff_earnings_insert_org" ON public.staff_earnings;
DROP POLICY IF EXISTS "staff_earnings_update_org" ON public.staff_earnings;
DROP POLICY IF EXISTS "staff_earnings_delete_org" ON public.staff_earnings;

-- 1g. New direct RLS policies
CREATE POLICY "staff_earnings_select_org"
  ON public.staff_earnings FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      staff_id IN (SELECT s.id FROM public.staff s WHERE s.profile_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager'))
    )
  );

CREATE POLICY "staff_earnings_insert_org"
  ON public.staff_earnings FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager'))
  );

CREATE POLICY "staff_earnings_update_org"
  ON public.staff_earnings FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager'))
  )
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "staff_earnings_delete_org"
  ON public.staff_earnings FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager'))
  );


-- =============================================================================
-- 2. staff_salary_advances
-- =============================================================================

-- 2a. Add nullable column
ALTER TABLE public.staff_salary_advances
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 2b. Backfill from staff
UPDATE public.staff_salary_advances ssa
SET organization_id = s.organization_id
FROM public.staff s
WHERE ssa.staff_id = s.id
  AND ssa.organization_id IS NULL;

-- 2c. Set NOT NULL
ALTER TABLE public.staff_salary_advances
  ALTER COLUMN organization_id SET NOT NULL;

-- 2d. Add index
CREATE INDEX IF NOT EXISTS idx_staff_salary_advances_org
  ON public.staff_salary_advances (organization_id);

-- 2e. Drop old RLS policies
DROP POLICY IF EXISTS "salary_advances_select_mgr_org" ON public.staff_salary_advances;
DROP POLICY IF EXISTS "salary_advances_select_stylist_own" ON public.staff_salary_advances;
DROP POLICY IF EXISTS "salary_advances_insert_mgr_org" ON public.staff_salary_advances;
DROP POLICY IF EXISTS "salary_advances_insert_stylist_own" ON public.staff_salary_advances;

-- 2f. New direct RLS policies
CREATE POLICY "salary_advances_select_mgr_org"
  ON public.staff_salary_advances FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager'))
  );

CREATE POLICY "salary_advances_select_stylist_own"
  ON public.staff_salary_advances FOR SELECT TO authenticated
  USING (
    staff_id IN (SELECT s.id FROM public.staff s WHERE s.profile_id = auth.uid())
  );

CREATE POLICY "salary_advances_insert_mgr_org"
  ON public.staff_salary_advances FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager'))
  );

CREATE POLICY "salary_advances_delete_mgr_org"
  ON public.staff_salary_advances FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager'))
  );


-- =============================================================================
-- 3. salary_settings
-- =============================================================================

-- 3a. Add nullable column
ALTER TABLE public.salary_settings
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 3b. Backfill from staff
UPDATE public.salary_settings ss
SET organization_id = s.organization_id
FROM public.staff s
WHERE ss.staff_id = s.id
  AND ss.organization_id IS NULL;

-- 3c. Set NOT NULL
ALTER TABLE public.salary_settings
  ALTER COLUMN organization_id SET NOT NULL;

-- 3d. Update unique constraint: UNIQUE(staff_id) → UNIQUE(organization_id, staff_id)
ALTER TABLE public.salary_settings
  DROP CONSTRAINT IF EXISTS salary_settings_staff_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'salary_settings'
      AND constraint_name = 'salary_settings_organization_id_staff_id_key'
  ) THEN
    ALTER TABLE public.salary_settings
      ADD CONSTRAINT salary_settings_organization_id_staff_id_key
      UNIQUE (organization_id, staff_id);
  END IF;
END $$;

-- 3e. Add index
CREATE INDEX IF NOT EXISTS idx_salary_settings_org
  ON public.salary_settings (organization_id);

-- 3f. Drop old RLS policies
DROP POLICY IF EXISTS "salary_settings_select_org" ON public.salary_settings;
DROP POLICY IF EXISTS "salary_settings_insert_owner_org" ON public.salary_settings;
DROP POLICY IF EXISTS "salary_settings_update_owner_org" ON public.salary_settings;
DROP POLICY IF EXISTS "salary_settings_delete_owner_org" ON public.salary_settings;

-- 3g. New direct RLS policies
CREATE POLICY "salary_settings_select_org"
  ON public.salary_settings FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      staff_id IN (SELECT s.id FROM public.staff s WHERE s.profile_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager'))
    )
  );

CREATE POLICY "salary_settings_insert_owner_org"
  ON public.salary_settings FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'Owner')
  );

CREATE POLICY "salary_settings_update_owner_org"
  ON public.salary_settings FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'Owner')
  )
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "salary_settings_delete_owner_org"
  ON public.salary_settings FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'Owner')
  );


-- =============================================================================
-- 4. stylist_breaks
-- =============================================================================

-- 4a. Add nullable column
ALTER TABLE public.stylist_breaks
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 4b. Backfill from staff
UPDATE public.stylist_breaks sb
SET organization_id = s.organization_id
FROM public.staff s
WHERE sb.stylist_id = s.id
  AND sb.organization_id IS NULL;

-- 4c. Set NOT NULL
ALTER TABLE public.stylist_breaks
  ALTER COLUMN organization_id SET NOT NULL;

-- 4d. Add index
CREATE INDEX IF NOT EXISTS idx_stylist_breaks_org
  ON public.stylist_breaks (organization_id);

-- 4e. Drop old RLS policies
DROP POLICY IF EXISTS "stylist_breaks_select_org" ON public.stylist_breaks;
DROP POLICY IF EXISTS "stylist_breaks_mutate_own_or_owner" ON public.stylist_breaks;

-- 4f. New direct RLS policies
CREATE POLICY "stylist_breaks_select_org"
  ON public.stylist_breaks FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "stylist_breaks_mutate_own_or_owner"
  ON public.stylist_breaks FOR ALL TO authenticated
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


-- =============================================================================
-- 5. stylist_availability
-- =============================================================================

-- 5a. Add nullable column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stylist_availability'
  ) THEN
    -- Add column if not exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'stylist_availability'
        AND column_name = 'organization_id'
    ) THEN
      ALTER TABLE public.stylist_availability
        ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
    END IF;

    -- 5b. Backfill from staff
    UPDATE public.stylist_availability sa
    SET organization_id = s.organization_id
    FROM public.staff s
    WHERE sa.stylist_id = s.id
      AND sa.organization_id IS NULL;

    -- 5c. Set NOT NULL
    ALTER TABLE public.stylist_availability
      ALTER COLUMN organization_id SET NOT NULL;

    -- 5d. Add index
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_stylist_availability_org ON public.stylist_availability (organization_id)';

    -- 5e. Drop old RLS policies
    DROP POLICY IF EXISTS "stylist_availability_select_org" ON public.stylist_availability;
    DROP POLICY IF EXISTS "stylist_availability_mutate_org" ON public.stylist_availability;

    -- 5f. New direct RLS policies
    EXECUTE '
      CREATE POLICY "stylist_availability_select_org"
        ON public.stylist_availability FOR SELECT TO authenticated
        USING (
          organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
        )
    ';

    EXECUTE '
      CREATE POLICY "stylist_availability_mutate_org"
        ON public.stylist_availability FOR ALL TO authenticated
        USING (
          organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
          AND (
            stylist_id IN (SELECT s.id FROM public.staff s WHERE s.profile_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN (''Owner'', ''Manager''))
          )
        )
        WITH CHECK (
          organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
        )
    ';
  END IF;
END $$;
