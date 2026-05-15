-- Drop the old role columns entirely from staff and profiles.
-- system_role is the only role identifier now.
-- display_name is always fetched from organization_roles.

ALTER TABLE public.staff    DROP COLUMN IF EXISTS role;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;
