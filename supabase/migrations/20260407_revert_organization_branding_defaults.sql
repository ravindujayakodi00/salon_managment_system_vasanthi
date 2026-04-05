-- Restore default branding seeds to olive + teal (per-tenant colors set in Settings or seed scripts).

ALTER TABLE public.organizations
  ALTER COLUMN primary_color SET DEFAULT '#4B5945';

ALTER TABLE public.organizations
  ALTER COLUMN secondary_color SET DEFAULT '#0d9488';

COMMENT ON COLUMN public.organizations.primary_color IS 'Seed hex for generated primary palette (dashboard + chrome)';
COMMENT ON COLUMN public.organizations.secondary_color IS 'Seed hex for generated secondary / accent palette';
