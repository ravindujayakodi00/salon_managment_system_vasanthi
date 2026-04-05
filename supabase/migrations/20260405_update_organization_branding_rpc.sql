-- Branding updates: bypass flaky PostgREST+RLS "0 rows updated" by using a locked-down RPC.
-- Requires 20260404_organization_branding.sql (branding columns on organizations).

CREATE OR REPLACE FUNCTION public.update_organization_branding(
  p_organization_id uuid,
  p_display_name text,
  p_tagline text,
  p_logo_url text,
  p_favicon_url text,
  p_primary_color text,
  p_secondary_color text,
  p_accent_color text,
  p_contact_email text,
  p_contact_phone text,
  p_timezone text
)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_role text;
  result public.organizations%ROWTYPE;
BEGIN
  SELECT organization_id, role INTO v_org, v_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Not linked to an organization';
  END IF;

  IF v_org IS DISTINCT FROM p_organization_id THEN
    RAISE EXCEPTION 'Organization does not match your profile';
  END IF;

  IF v_role IS DISTINCT FROM 'Owner' THEN
    RAISE EXCEPTION 'Only the salon Owner can update organization branding';
  END IF;

  UPDATE public.organizations o
  SET
    display_name = p_display_name,
    tagline = p_tagline,
    logo_url = p_logo_url,
    favicon_url = p_favicon_url,
    primary_color = p_primary_color,
    secondary_color = p_secondary_color,
    accent_color = p_accent_color,
    contact_email = p_contact_email,
    contact_phone = p_contact_phone,
    timezone = p_timezone,
    updated_at = now()
  WHERE o.id = p_organization_id
  RETURNING * INTO result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_organization_branding(
  uuid, text, text, text, text, text, text, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_organization_branding(
  uuid, text, text, text, text, text, text, text, text, text, text
) TO authenticated;

COMMENT ON FUNCTION public.update_organization_branding IS
  'Updates org branding; SECURITY DEFINER; caller must be Owner of p_organization_id.';
