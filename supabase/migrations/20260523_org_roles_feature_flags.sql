-- Migration: Dynamic role system — feature flags + role_level + org_role_id
-- Run this in the Supabase SQL Editor.
-- Applies to the shared database used by both Vasanthi and Dione apps.
-- Safe to re-run — all steps are idempotent.

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Drop CHECK constraint on organization_roles.system_role
-- This allows organizations to define truly custom system role strings
-- (previously limited to the 4 fixed values).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.organization_roles
  DROP CONSTRAINT IF EXISTS organization_roles_system_role_check;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Add role_level to organization_roles
-- Numeric tier: 1=Owner, 2=Manager, 3=Receptionist, 4=Staff.
-- Lower number = more authority.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.organization_roles
  ADD COLUMN IF NOT EXISTS role_level smallint NOT NULL DEFAULT 4;

-- Backfill role_level from existing system_role values (all rows start at DEFAULT 4)
UPDATE public.organization_roles
SET role_level = CASE
  WHEN system_role = 'Owner'        THEN 1
  WHEN system_role = 'Manager'      THEN 2
  WHEN system_role = 'Receptionist' THEN 3
  ELSE 4
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Add feature flag columns to organization_roles
-- Each flag controls a specific capability. Defaults are all off.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.organization_roles
  ADD COLUMN IF NOT EXISTS can_earn_commission   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_bookable           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_staff      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_settings   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_all_earnings boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_reports      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_process_pos       boolean NOT NULL DEFAULT false;

-- Backfill feature flags from system_role for all existing rows.
-- Uses system_role (not display_name) so renamed roles like
-- "Beautician" (system_role='Stylist') are handled correctly.
UPDATE public.organization_roles
SET
  can_earn_commission   = (system_role = 'Stylist'),
  is_bookable           = (system_role IN ('Stylist', 'Receptionist')),
  can_manage_staff      = (system_role IN ('Owner', 'Manager')),
  can_manage_settings   = (system_role IN ('Owner', 'Manager')),
  can_view_all_earnings = (system_role IN ('Owner', 'Manager')),
  can_view_reports      = (system_role IN ('Owner', 'Manager')),
  can_process_pos       = (system_role IN ('Owner', 'Manager', 'Receptionist'));

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Add org_role_id to profiles and staff
-- Links each user/staff member to their exact org role (for feature flag lookups).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS org_role_id uuid;

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS org_role_id uuid;

-- FK constraints (nullable — safe to add even if some rows have no match yet)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_org_role_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_org_role_id_fkey
      FOREIGN KEY (org_role_id) REFERENCES public.organization_roles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'staff_org_role_id_fkey'
  ) THEN
    ALTER TABLE public.staff
      ADD CONSTRAINT staff_org_role_id_fkey
      FOREIGN KEY (org_role_id) REFERENCES public.organization_roles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Backfill org_role_id for existing profiles and staff
-- Matches on system_role so renamed roles (e.g. Beautician→Stylist) resolve correctly.
-- Prefers non-deletable (default) roles when multiple exist for the same tier.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.profiles p
SET org_role_id = (
  SELECT r.id
  FROM public.organization_roles r
  WHERE r.organization_id = p.organization_id
    AND r.system_role = p.system_role
  ORDER BY r.is_deletable ASC, r.created_at ASC
  LIMIT 1
)
WHERE p.org_role_id IS NULL
  AND p.organization_id IS NOT NULL;

UPDATE public.staff s
SET org_role_id = (
  SELECT r.id
  FROM public.organization_roles r
  WHERE r.organization_id = s.organization_id
    AND r.system_role = s.system_role
  ORDER BY r.is_deletable ASC, r.created_at ASC
  LIMIT 1
)
WHERE s.org_role_id IS NULL
  AND s.organization_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: Trigger — auto-compute role_level on INSERT
-- Only sets role_level (deterministic from system_role for the 4 known tiers).
-- Feature flags are NOT auto-set here — callers must always provide them
-- explicitly so that intentional `false` values are never overridden.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_org_role_defaults()
RETURNS TRIGGER AS $$
BEGIN
  -- For the 4 known system roles, override role_level to the canonical value.
  -- For custom system_role strings, keep whatever role_level was passed.
  NEW.role_level := CASE
    WHEN NEW.system_role = 'Owner'        THEN 1
    WHEN NEW.system_role = 'Manager'      THEN 2
    WHEN NEW.system_role = 'Receptionist' THEN 3
    ELSE NEW.role_level
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS org_role_defaults ON public.organization_roles;
CREATE TRIGGER org_role_defaults
  BEFORE INSERT ON public.organization_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_org_role_defaults();

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7: Seed default roles for organizations that are missing a tier.
-- Uses NOT EXISTS on system_role — so renamed roles (e.g. "Beautician" with
-- system_role='Stylist') are NOT duplicated with a second "Stylist" row.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.organization_roles
  (organization_id, display_name, system_role, is_deletable, role_level,
   can_earn_commission, is_bookable, can_manage_staff, can_manage_settings,
   can_view_all_earnings, can_view_reports, can_process_pos)
SELECT o.id, 'Owner', 'Owner', false, 1, false, false, true, true, true, true, true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_roles r
  WHERE r.organization_id = o.id AND r.system_role = 'Owner'
)
UNION ALL
SELECT o.id, 'Manager', 'Manager', false, 2, false, false, true, true, true, true, true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_roles r
  WHERE r.organization_id = o.id AND r.system_role = 'Manager'
)
UNION ALL
SELECT o.id, 'Receptionist', 'Receptionist', true, 3, false, true, false, false, false, false, true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_roles r
  WHERE r.organization_id = o.id AND r.system_role = 'Receptionist'
)
UNION ALL
SELECT o.id, 'Stylist', 'Stylist', true, 4, true, true, false, false, false, false, false
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_roles r
  WHERE r.organization_id = o.id AND r.system_role = 'Stylist'
);
