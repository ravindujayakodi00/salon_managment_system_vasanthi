BEGIN;

-- Replace customer.segment_tags with explicit, organization-scoped segment
-- memberships while preserving all existing tag-based memberships.

DROP TRIGGER IF EXISTS trigger_appointment_completion_updates_customer ON public.appointments;
DROP TRIGGER IF EXISTS trigger_invoice_creation_updates_customer ON public.invoices;
DROP FUNCTION IF EXISTS public.trigger_update_customer_on_appointment();
DROP FUNCTION IF EXISTS public.trigger_update_customer_on_invoice();
DROP FUNCTION IF EXISTS public.auto_categorize_customer(uuid);
DROP FUNCTION IF EXISTS public.refresh_segment_counts();

-- Keep the existing customer-stat maintenance, but remove the old automatic
-- tag categorization. Segment membership is manual after this migration.
CREATE FUNCTION public.trigger_update_customer_on_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'Completed' AND OLD.status IS DISTINCT FROM 'Completed' THEN
    IF to_regprocedure('public.update_customer_stats(uuid)') IS NOT NULL THEN
      PERFORM public.update_customer_stats(NEW.customer_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.trigger_update_customer_on_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF to_regprocedure('public.update_customer_stats(uuid)') IS NOT NULL THEN
    PERFORM public.update_customer_stats(NEW.customer_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_appointment_completion_updates_customer
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_customer_on_appointment();

CREATE TRIGGER trigger_invoice_creation_updates_customer
  AFTER INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_customer_on_invoice();

ALTER TABLE public.customer_segments
  DROP CONSTRAINT IF EXISTS customer_segments_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_segments_org_name
  ON public.customer_segments (organization_id, name);

CREATE TABLE IF NOT EXISTS public.customer_customer_segments_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES public.customer_segments(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_customer_segments_mapping_unique
    UNIQUE (organization_id, customer_id, segment_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_segment_mapping_org_segment
  ON public.customer_customer_segments_mapping (organization_id, segment_id);

CREATE INDEX IF NOT EXISTS idx_customer_segment_mapping_org_customer
  ON public.customer_customer_segments_mapping (organization_id, customer_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name = 'segment_tags'
  ) THEN
    INSERT INTO public.customer_customer_segments_mapping (
      organization_id,
      customer_id,
      segment_id
    )
    SELECT
      c.organization_id,
      c.id,
      s.id
    FROM public.customers c
    CROSS JOIN LATERAL unnest(COALESCE(c.segment_tags, ARRAY[]::text[])) AS tag(name)
    JOIN public.customer_segments s
      ON s.organization_id = c.organization_id
     AND s.name = tag.name
    ON CONFLICT (organization_id, customer_id, segment_id) DO NOTHING;
  END IF;
END;
$$;

ALTER TABLE public.customers
  DROP COLUMN IF EXISTS segment_tags;

ALTER TABLE public.customer_customer_segments_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_segment_mapping_select_org" ON public.customer_customer_segments_mapping;
DROP POLICY IF EXISTS "customer_segment_mapping_insert_mgr" ON public.customer_customer_segments_mapping;
DROP POLICY IF EXISTS "customer_segment_mapping_delete_mgr" ON public.customer_customer_segments_mapping;

CREATE POLICY "customer_segment_mapping_select_org"
  ON public.customer_customer_segments_mapping
  FOR SELECT TO authenticated
  USING (
    organization_id = (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "customer_segment_mapping_insert_mgr"
  ON public.customer_customer_segments_mapping
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.system_role IN ('Owner', 'Manager')
        AND p.is_active = true
    )
    AND EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_customer_segments_mapping.customer_id
        AND c.organization_id = customer_customer_segments_mapping.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM public.customer_segments s
      WHERE s.id = customer_customer_segments_mapping.segment_id
        AND s.organization_id = customer_customer_segments_mapping.organization_id
    )
  );

CREATE POLICY "customer_segment_mapping_delete_mgr"
  ON public.customer_customer_segments_mapping
  FOR DELETE TO authenticated
  USING (
    organization_id = (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.system_role IN ('Owner', 'Manager')
        AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "segments_insert_owner" ON public.customer_segments;
DROP POLICY IF EXISTS "segments_update_owner" ON public.customer_segments;
DROP POLICY IF EXISTS "segments_delete_owner" ON public.customer_segments;
DROP POLICY IF EXISTS "Owner can manage segments" ON public.customer_segments;
DROP POLICY IF EXISTS "segments_insert_mgr" ON public.customer_segments;
DROP POLICY IF EXISTS "segments_update_mgr" ON public.customer_segments;
DROP POLICY IF EXISTS "segments_delete_mgr" ON public.customer_segments;

CREATE POLICY "segments_insert_mgr"
  ON public.customer_segments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.system_role IN ('Owner', 'Manager')
        AND p.is_active = true
    )
  );

CREATE POLICY "segments_update_mgr"
  ON public.customer_segments
  FOR UPDATE TO authenticated
  USING (
    organization_id = (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.system_role IN ('Owner', 'Manager')
        AND p.is_active = true
    )
  )
  WITH CHECK (
    organization_id = (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "segments_delete_mgr"
  ON public.customer_segments
  FOR DELETE TO authenticated
  USING (
    organization_id = (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.system_role IN ('Owner', 'Manager')
        AND p.is_active = true
    )
  );

CREATE OR REPLACE FUNCTION public.get_segment_customer_candidates(
  p_organization_id UUID,
  p_segment_id UUID,
  p_search TEXT DEFAULT NULL,
  p_service_name TEXT DEFAULT NULL,
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  customer_id UUID,
  customer_name TEXT,
  phone TEXT,
  email TEXT,
  is_mapped BOOLEAN,
  total_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH eligible AS (
    SELECT c.id, c.name, c.phone, c.email
    FROM public.customers c
    WHERE c.organization_id = p_organization_id
      AND c.is_active = true
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.organization_id = p_organization_id
          AND p.is_active = true
      )
      AND (
        NULLIF(btrim(p_search), '') IS NULL
        OR c.name ILIKE '%' || btrim(p_search) || '%'
        OR c.phone ILIKE '%' || btrim(p_search) || '%'
        OR COALESCE(c.email, '') ILIKE '%' || btrim(p_search) || '%'
      )
      AND (
        NULLIF(btrim(p_service_name), '') IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.invoices i
          CROSS JOIN LATERAL jsonb_array_elements(i.items) item
          WHERE i.organization_id = p_organization_id
            AND i.customer_id = c.id
            AND item->>'type' IN ('appointment', 'service', 'walk-in-service')
            AND lower(btrim(item->>'name')) = lower(btrim(p_service_name))
        )
      )
  )
  SELECT
    e.id,
    e.name,
    e.phone,
    e.email,
    EXISTS (
      SELECT 1
      FROM public.customer_customer_segments_mapping m
      WHERE m.organization_id = p_organization_id
        AND m.segment_id = p_segment_id
        AND m.customer_id = e.id
    ),
    count(*) OVER ()
  FROM eligible e
  ORDER BY e.name, e.id
  OFFSET GREATEST(p_offset, 0)
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

CREATE OR REPLACE FUNCTION public.get_customer_segment_service_options(
  p_organization_id UUID
)
RETURNS TABLE (service_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT btrim(item->>'name') AS service_name
  FROM public.invoices i
  CROSS JOIN LATERAL jsonb_array_elements(i.items) item
  WHERE i.organization_id = p_organization_id
    AND item->>'type' IN ('appointment', 'service', 'walk-in-service')
    AND NULLIF(btrim(item->>'name'), '') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id = p_organization_id
        AND p.is_active = true
    )
  ORDER BY service_name;
$$;

CREATE OR REPLACE FUNCTION public.map_filtered_customers_to_segment(
  p_organization_id UUID,
  p_segment_id UUID,
  p_search TEXT DEFAULT NULL,
  p_service_name TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.organization_id = p_organization_id
      AND p.system_role IN ('Owner', 'Manager')
      AND p.is_active = true
  ) THEN
    RAISE EXCEPTION 'Not authorized to manage customer segments';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.customer_segments s
    WHERE s.id = p_segment_id
      AND s.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Segment not found';
  END IF;

  WITH eligible AS (
    SELECT c.id
    FROM public.customers c
    WHERE c.organization_id = p_organization_id
      AND c.is_active = true
      AND (
        NULLIF(btrim(p_search), '') IS NULL
        OR c.name ILIKE '%' || btrim(p_search) || '%'
        OR c.phone ILIKE '%' || btrim(p_search) || '%'
        OR COALESCE(c.email, '') ILIKE '%' || btrim(p_search) || '%'
      )
      AND (
        NULLIF(btrim(p_service_name), '') IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.invoices i
          CROSS JOIN LATERAL jsonb_array_elements(i.items) item
          WHERE i.organization_id = p_organization_id
            AND i.customer_id = c.id
            AND item->>'type' IN ('appointment', 'service', 'walk-in-service')
            AND lower(btrim(item->>'name')) = lower(btrim(p_service_name))
        )
      )
  ), inserted AS (
    INSERT INTO public.customer_customer_segments_mapping (
      organization_id,
      customer_id,
      segment_id,
      created_by
    )
    SELECT p_organization_id, e.id, p_segment_id, auth.uid()
    FROM eligible e
    ON CONFLICT (organization_id, customer_id, segment_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::INTEGER INTO inserted_count FROM inserted;

  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.get_segment_customer_candidates(uuid, uuid, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_segment_customer_candidates(uuid, uuid, text, text, integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_customer_segment_service_options(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_segment_service_options(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.map_filtered_customers_to_segment(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.map_filtered_customers_to_segment(uuid, uuid, text, text) TO authenticated;

COMMIT;
