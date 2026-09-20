-- Return one organization page of customers ordered by their invoice-derived last visit.

CREATE OR REPLACE FUNCTION public.get_customers_sorted_by_last_visit(
    p_organization_id uuid,
    p_sort_direction text DEFAULT 'desc',
    p_limit integer DEFAULT 200,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    customer_data jsonb,
    total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        to_jsonb(c) AS customer_data,
        COUNT(*) OVER () AS total_count
    FROM public.customers c
    LEFT JOIN (
        SELECT
            i.customer_id,
            MAX(i.created_at) AS last_visit
        FROM public.invoices i
        WHERE i.organization_id = p_organization_id
        GROUP BY i.customer_id
    ) visits ON visits.customer_id = c.id
    WHERE c.organization_id = p_organization_id
      AND EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.organization_id = p_organization_id
            AND p.is_active = true
      )
    ORDER BY
        CASE WHEN lower(p_sort_direction) = 'asc' THEN visits.last_visit END ASC NULLS LAST,
        CASE WHEN lower(p_sort_direction) = 'desc' THEN visits.last_visit END DESC NULLS LAST,
        c.created_at DESC,
        c.id
    LIMIT LEAST(GREATEST(p_limit, 1), 500)
    OFFSET GREATEST(p_offset, 0);
$$;

REVOKE ALL ON FUNCTION public.get_customers_sorted_by_last_visit(uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customers_sorted_by_last_visit(uuid, text, integer, integer) TO authenticated;
