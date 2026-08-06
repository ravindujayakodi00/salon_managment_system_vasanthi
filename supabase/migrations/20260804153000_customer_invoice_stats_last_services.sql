-- Extend live customer invoice statistics with services from the latest invoice.

DROP FUNCTION IF EXISTS public.get_customer_invoice_stats(uuid, uuid[]);

CREATE FUNCTION public.get_customer_invoice_stats(
    p_organization_id uuid,
    p_customer_ids uuid[]
)
RETURNS TABLE (
    customer_id uuid,
    total_visits bigint,
    last_visit timestamp with time zone,
    last_services text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH scoped_invoices AS (
        SELECT i.id, i.customer_id, i.created_at, i.items
        FROM public.invoices i
        WHERE i.organization_id = p_organization_id
          AND i.customer_id = ANY(p_customer_ids)
          AND EXISTS (
              SELECT 1
              FROM public.profiles p
              WHERE p.id = auth.uid()
                AND p.organization_id = p_organization_id
                AND p.is_active = true
          )
    ),
    invoice_stats AS (
        SELECT
            i.customer_id,
            COUNT(i.id) AS total_visits,
            MAX(i.created_at) AS last_visit
        FROM scoped_invoices i
        GROUP BY i.customer_id
    ),
    latest_invoices AS (
        SELECT DISTINCT ON (i.customer_id)
            i.customer_id,
            i.items
        FROM scoped_invoices i
        ORDER BY i.customer_id, i.created_at DESC, i.id DESC
    )
    SELECT
        stats.customer_id,
        stats.total_visits,
        stats.last_visit,
        COALESCE(
            (
                SELECT string_agg(
                    DISTINCT btrim(item->>'name'),
                    ', ' ORDER BY btrim(item->>'name')
                )
                FROM jsonb_array_elements(latest.items) item
                WHERE item->>'type' IN ('appointment', 'service', 'walk-in-service')
                  AND NULLIF(btrim(item->>'name'), '') IS NOT NULL
            ),
            'None'
        ) AS last_services
    FROM invoice_stats stats
    JOIN latest_invoices latest ON latest.customer_id = stats.customer_id;
$$;

REVOKE ALL ON FUNCTION public.get_customer_invoice_stats(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_invoice_stats(uuid, uuid[]) TO authenticated;
