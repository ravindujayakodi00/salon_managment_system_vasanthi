-- Migration: Custom roles per organization
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to run on production data — all steps are non-destructive.

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Create organization_roles lookup table
-- Each org can define its own role names mapped to one of the 4 system roles.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_roles (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid       NOT NULL,
  display_name   text        NOT NULL,
  system_role    text        NOT NULL CHECK (system_role = ANY (ARRAY['Owner'::text, 'Manager'::text, 'Receptionist'::text, 'Stylist'::text])),
  is_deletable   boolean     NOT NULL DEFAULT true,
  created_at     timestamp with time zone DEFAULT now(),
  CONSTRAINT organization_roles_pkey PRIMARY KEY (id),
  CONSTRAINT organization_roles_org_name_unique UNIQUE (organization_id, display_name),
  CONSTRAINT organization_roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Seed default roles for all existing organizations
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.organization_roles (organization_id, display_name, system_role, is_deletable)
SELECT o.id, 'Owner',        'Owner',        false FROM public.organizations o
UNION ALL
SELECT o.id, 'Manager',      'Manager',      false FROM public.organizations o
UNION ALL
SELECT o.id, 'Receptionist', 'Receptionist', true  FROM public.organizations o
UNION ALL
SELECT o.id, 'Stylist',      'Stylist',      true  FROM public.organizations o
ON CONFLICT (organization_id, display_name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Add system_role column to staff table and backfill
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS system_role text;

-- Backfill: existing role values are already system role names
UPDATE public.staff SET system_role = role WHERE system_role IS NULL;

-- Add NOT NULL + CHECK constraint
ALTER TABLE public.staff
  ALTER COLUMN system_role SET NOT NULL;

ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_system_role_check;

ALTER TABLE public.staff
  ADD CONSTRAINT staff_system_role_check
  CHECK (system_role = ANY (ARRAY['Owner'::text, 'Manager'::text, 'Receptionist'::text, 'Stylist'::text]));

-- Drop the old role CHECK constraint (role column becomes free-text display name)
ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_role_check;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Add system_role column to profiles table and backfill
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS system_role text;

UPDATE public.profiles SET system_role = role WHERE system_role IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN system_role SET NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_system_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_system_role_check
  CHECK (system_role = ANY (ARRAY['Owner'::text, 'Manager'::text, 'Receptionist'::text, 'Stylist'::text]));

-- Drop old CHECK constraint on profiles.role
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Drop CHECK constraint on commission_settings.role
-- commission_settings.role continues to store system_role values for now
-- (commission rules apply per system role, not per custom display name)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.commission_settings
  DROP CONSTRAINT IF EXISTS commission_settings_role_check;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: Drop CHECK constraint on organization_page_access.role
-- page_access.role stores system_role values (stable identifiers)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.organization_page_access
  DROP CONSTRAINT IF EXISTS organization_page_access_role_check;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7: Enable RLS on organization_roles and add policies
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.organization_roles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own org's roles
DROP POLICY IF EXISTS "org_roles_select" ON public.organization_roles;
CREATE POLICY "org_roles_select"
  ON public.organization_roles FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Only Owner/Manager can insert/update/delete roles
DROP POLICY IF EXISTS "org_roles_insert" ON public.organization_roles;
CREATE POLICY "org_roles_insert"
  ON public.organization_roles FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND system_role IN ('Owner', 'Manager')
    )
  );

DROP POLICY IF EXISTS "org_roles_update" ON public.organization_roles;
CREATE POLICY "org_roles_update"
  ON public.organization_roles FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND system_role IN ('Owner', 'Manager')
    )
  );

DROP POLICY IF EXISTS "org_roles_delete" ON public.organization_roles;
CREATE POLICY "org_roles_delete"
  ON public.organization_roles FOR DELETE
  USING (
    is_deletable = true AND
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND system_role IN ('Owner', 'Manager')
    )
  );
