-- Read org row for branding/settings even when PostgREST SELECT is flaky under RLS.
-- Caller must belong to p_organization_id (same rule as org_select_member).

CREATE OR REPLACE FUNCTION public.get_organization_branding(p_organization_id uuid)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result public.organizations%ROWTYPE;
BEGIN
  SELECT o.*
  INTO result
  FROM public.organizations o
  WHERE o.id = p_organization_id
    AND o.id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid());

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_organization_branding(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_organization_branding(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_organization_branding IS
  'Returns organizations row for current user tenant; SECURITY DEFINER; used for branding merge when RLS SELECT returns 0 rows.';
