-- Critical tenant-boundary hardening.
--
-- 1. Authenticated clients cannot create their own profile and choose a tenant/role.
-- 2. Authenticated clients may update harmless fields on their own profile, but cannot
--    change tenant, role, branch, active state, or identity fields.
-- 3. The legacy profiles.role value is kept synchronized with system_role while older
--    RLS policies are migrated away from the legacy column.

BEGIN;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Avoid policy stacking: replace every profile policy with this intentionally small set.
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', policy_row.policyname);
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.current_profile_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_profile_system_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT system_role
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active = true
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_profile_organization_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_profile_system_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_profile_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_system_role() TO authenticated;

-- There is deliberately no INSERT policy for authenticated. Profiles must be created
-- by a trusted server-side administrative flow using the service role.
CREATE POLICY "profiles_select_self_or_mgr"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (
      organization_id = public.current_profile_organization_id()
      AND public.current_profile_system_role() IN ('Owner', 'Manager')
    )
  );

CREATE POLICY "profiles_update_self_safe"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    AND is_active = true
    AND organization_id = public.current_profile_organization_id()
  )
  WITH CHECK (
    id = auth.uid()
    AND is_active = true
    AND organization_id = public.current_profile_organization_id()
  );

-- Keep the legacy role column synchronized before installing the mutation guard.
-- Dynamic SQL keeps this migration valid after deployments where role was dropped.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET role = system_role WHERE role IS DISTINCT FROM system_role';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND auth.uid() IS NOT NULL
     AND auth.role() <> 'service_role'
  THEN
    IF to_jsonb(NEW) -> 'id'              IS DISTINCT FROM to_jsonb(OLD) -> 'id'
       OR to_jsonb(NEW) -> 'organization_id' IS DISTINCT FROM to_jsonb(OLD) -> 'organization_id'
       OR to_jsonb(NEW) -> 'system_role'  IS DISTINCT FROM to_jsonb(OLD) -> 'system_role'
       OR to_jsonb(NEW) -> 'role'         IS DISTINCT FROM to_jsonb(OLD) -> 'role'
       OR to_jsonb(NEW) -> 'org_role_id'  IS DISTINCT FROM to_jsonb(OLD) -> 'org_role_id'
       OR to_jsonb(NEW) -> 'branch_id'    IS DISTINCT FROM to_jsonb(OLD) -> 'branch_id'
       OR to_jsonb(NEW) -> 'is_active'    IS DISTINCT FROM to_jsonb(OLD) -> 'is_active'
    THEN
      RAISE EXCEPTION 'Authorization fields can only be changed by a trusted server operation'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Older policies still read profiles.role. jsonb_populate_record ignores the key
  -- when that legacy column has already been removed.
  IF to_jsonb(NEW) ? 'role' AND to_jsonb(NEW) ? 'system_role' THEN
    NEW := jsonb_populate_record(
      NEW,
      jsonb_build_object('role', to_jsonb(NEW) -> 'system_role')
    );
  END IF;

  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.protect_profile_security_fields() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_profile_security_fields() FROM anon, authenticated;

DROP TRIGGER IF EXISTS protect_profile_security_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_security_fields_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_security_fields();

-- Some databases still retain staff.role because older RLS dependencies prevented
-- the historical DROP migration. Keep it nullable and synchronized so server-side
-- staff creation can use system_role as the source of truth.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'staff'
      AND column_name = 'role'
  ) THEN
    EXECUTE 'ALTER TABLE public.staff ALTER COLUMN role DROP NOT NULL';
    EXECUTE 'UPDATE public.staff SET role = system_role WHERE role IS DISTINCT FROM system_role';
  END IF;
END
$$;

DROP TRIGGER IF EXISTS protect_staff_security_fields_trigger ON public.staff;
CREATE TRIGGER protect_staff_security_fields_trigger
  BEFORE INSERT OR UPDATE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_security_fields();

COMMIT;
