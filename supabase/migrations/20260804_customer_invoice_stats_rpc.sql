-- Calculate customer visit statistics directly from saved invoices.

CREATE OR REPLACE FUNCTION public.get_customer_invoice_stats(
    p_organization_id uuid,
    p_customer_ids uuid[]
)
RETURNS TABLE (
    customer_id uuid,
    total_visits bigint,
    last_visit timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        i.customer_id,
        COUNT(i.id) AS total_visits,
        MAX(i.created_at) AS last_visit
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
    GROUP BY i.customer_id;
$$;

REVOKE ALL ON FUNCTION public.get_customer_invoice_stats(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_invoice_stats(uuid, uuid[]) TO authenticated;
