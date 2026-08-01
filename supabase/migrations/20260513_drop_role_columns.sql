-- Do not drop the legacy role columns yet. Older RLS policies still depend on
-- profiles.role, so PostgreSQL rejects the DROP without CASCADE and a fresh
-- migration run stops here. The tenant-security hardening migration keeps the
-- legacy value synchronized with system_role until every dependent policy has
-- been replaced and the columns can be removed in a dedicated migration.

DO $$
BEGIN
  RAISE NOTICE 'Legacy role columns retained for RLS compatibility; system_role remains the application source of truth.';
END
$$;
