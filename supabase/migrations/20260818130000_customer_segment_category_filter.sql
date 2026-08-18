BEGIN;

DROP FUNCTION IF EXISTS public.get_segment_customer_candidates(uuid, uuid, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_customer_segment_service_options(uuid);
DROP FUNCTION IF EXISTS public.map_filtered_customers_to_segment(uuid, uuid, text, text);

CREATE FUNCTION public.get_segment_customer_candidates(
  p_organization_id UUID,
  p_segment_id UUID,
  p_search TEXT DEFAULT NULL,
  p_service_category TEXT DEFAULT NULL,
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
        NULLIF(btrim(p_service_category), '') IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.invoices i
          CROSS JOIN LATERAL jsonb_array_elements(i.items) item
          JOIN public.services s
            ON s.organization_id = p_organization_id
           AND (
             s.id::text = item->>'serviceId'
             OR (
               NULLIF(item->>'serviceId', '') IS NULL
               AND lower(btrim(s.name)) = lower(btrim(item->>'name'))
             )
           )
          WHERE i.organization_id = p_organization_id
            AND i.customer_id = c.id
            AND item->>'type' IN ('appointment', 'service', 'walk-in-service')
            AND lower(btrim(s.category)) = lower(btrim(p_service_category))
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

CREATE FUNCTION public.get_customer_segment_category_options(
  p_organization_id UUID
)
RETURNS TABLE (service_category TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT btrim(s.category) AS service_category
  FROM public.invoices i
  CROSS JOIN LATERAL jsonb_array_elements(i.items) item
  JOIN public.services s
    ON s.organization_id = p_organization_id
   AND (
     s.id::text = item->>'serviceId'
     OR (
       NULLIF(item->>'serviceId', '') IS NULL
       AND lower(btrim(s.name)) = lower(btrim(item->>'name'))
     )
   )
  WHERE i.organization_id = p_organization_id
    AND item->>'type' IN ('appointment', 'service', 'walk-in-service')
    AND NULLIF(btrim(s.category), '') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id = p_organization_id
        AND p.is_active = true
    )
  ORDER BY service_category;
$$;

CREATE FUNCTION public.map_filtered_customers_to_segment(
  p_organization_id UUID,
  p_segment_id UUID,
  p_search TEXT DEFAULT NULL,
  p_service_category TEXT DEFAULT NULL
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
        NULLIF(btrim(p_service_category), '') IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.invoices i
          CROSS JOIN LATERAL jsonb_array_elements(i.items) item
          JOIN public.services s
            ON s.organization_id = p_organization_id
           AND (
             s.id::text = item->>'serviceId'
             OR (
               NULLIF(item->>'serviceId', '') IS NULL
               AND lower(btrim(s.name)) = lower(btrim(item->>'name'))
             )
           )
          WHERE i.organization_id = p_organization_id
            AND i.customer_id = c.id
            AND item->>'type' IN ('appointment', 'service', 'walk-in-service')
            AND lower(btrim(s.category)) = lower(btrim(p_service_category))
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

REVOKE ALL ON FUNCTION public.get_customer_segment_category_options(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_segment_category_options(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.map_filtered_customers_to_segment(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.map_filtered_customers_to_segment(uuid, uuid, text, text) TO authenticated;

COMMIT;
