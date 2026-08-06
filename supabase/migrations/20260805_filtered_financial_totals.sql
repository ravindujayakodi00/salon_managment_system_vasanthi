-- Full-dataset totals for paginated financial pages.
-- These functions use SECURITY INVOKER so existing RLS policies still control
-- which organization and branch rows the authenticated user can aggregate.

CREATE OR REPLACE FUNCTION public.get_invoice_summary(
    p_organization_id uuid,
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_branch_id uuid DEFAULT NULL,
    p_payment_method text DEFAULT NULL
)
RETURNS TABLE (
    total_revenue numeric,
    total_cash numeric,
    total_card numeric,
    total_bank_transfer numeric,
    transaction_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    WITH filtered_invoices AS (
        SELECT i.total, i.payment_method, i.payment_breakdown
        FROM public.invoices i
        WHERE i.organization_id = p_organization_id
          AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
          AND (p_payment_method IS NULL OR i.payment_method = p_payment_method)
          AND (p_start_date IS NULL OR i.created_at >= p_start_date::timestamp)
          AND (p_end_date IS NULL OR i.created_at < (p_end_date + 1)::timestamp)
    ),
    invoice_totals AS (
        SELECT
            COALESCE(SUM(fi.total), 0) AS total_revenue,
            COUNT(*) AS transaction_count
        FROM filtered_invoices fi
    ),
    payment_totals AS (
        SELECT
            COALESCE(SUM((payment.value ->> 'amount')::numeric)
                FILTER (WHERE payment.value ->> 'method' = 'Cash'), 0) AS total_cash,
            COALESCE(SUM((payment.value ->> 'amount')::numeric)
                FILTER (WHERE payment.value ->> 'method' = 'Card'), 0) AS total_card,
            COALESCE(SUM((payment.value ->> 'amount')::numeric)
                FILTER (WHERE payment.value ->> 'method' = 'BankTransfer'), 0) AS total_bank_transfer
        FROM filtered_invoices fi
        CROSS JOIN LATERAL jsonb_array_elements(
            CASE
                WHEN jsonb_typeof(fi.payment_breakdown) = 'array'
                     AND jsonb_array_length(fi.payment_breakdown) > 1
                THEN fi.payment_breakdown
                ELSE jsonb_build_array(jsonb_build_object(
                    'method', COALESCE(fi.payment_method, 'Cash'),
                    'amount', COALESCE(fi.total, 0)
                ))
            END
        ) AS payment(value)
    )
    SELECT
        it.total_revenue,
        pt.total_cash,
        pt.total_card,
        pt.total_bank_transfer,
        it.transaction_count
    FROM invoice_totals it
    CROSS JOIN payment_totals pt;
$$;

CREATE OR REPLACE FUNCTION public.get_petty_cash_summary(
    p_organization_id uuid,
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_branch_id uuid DEFAULT NULL,
    p_entry_type text DEFAULT NULL
)
RETURNS TABLE (
    total_withdrawals numeric,
    withdrawal_count bigint,
    current_balance numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    WITH period_totals AS (
        SELECT
            COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'withdrawal'), 0) AS total_withdrawals,
            COUNT(*) FILTER (WHERE t.type = 'withdrawal') AS withdrawal_count
        FROM public.petty_cash_transactions t
        WHERE t.organization_id = p_organization_id
          AND (p_branch_id IS NULL OR t.branch_id = p_branch_id)
          AND (p_entry_type IS NULL OR t.entry_type = p_entry_type)
          AND (p_start_date IS NULL OR t.created_at >= p_start_date::timestamp)
          AND (p_end_date IS NULL OR t.created_at < (p_end_date + 1)::timestamp)
    ),
    latest_branch_balances AS (
        SELECT DISTINCT ON (t.branch_id)
            t.branch_id,
            t.balance_after
        FROM public.petty_cash_transactions t
        WHERE t.organization_id = p_organization_id
          AND t.entry_type = 'petty_cash'
          AND (p_branch_id IS NULL OR t.branch_id = p_branch_id)
        ORDER BY t.branch_id, t.created_at DESC, t.id DESC
    ),
    balance_total AS (
        SELECT COALESCE(SUM(lbb.balance_after), 0) AS current_balance
        FROM latest_branch_balances lbb
    )
    SELECT pt.total_withdrawals, pt.withdrawal_count, bt.current_balance
    FROM period_totals pt
    CROSS JOIN balance_total bt;
$$;

CREATE OR REPLACE FUNCTION public.get_staff_earnings_totals(
    p_organization_id uuid,
    p_start_date date,
    p_end_date date,
    p_branch_id uuid DEFAULT NULL,
    p_staff_id uuid DEFAULT NULL
)
RETURNS TABLE (
    total_revenue numeric,
    total_commission numeric,
    appointments_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        COALESCE(SUM(se.service_revenue), 0) AS total_revenue,
        COALESCE(SUM(se.commission_amount), 0) AS total_commission,
        COALESCE(SUM(se.appointments_count), 0)::bigint AS appointments_count
    FROM public.staff_earnings se
    JOIN public.staff s ON s.id = se.staff_id
    WHERE se.organization_id = p_organization_id
      AND s.organization_id = p_organization_id
      AND se.date >= p_start_date
      AND se.date <= p_end_date
      AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
      AND (p_staff_id IS NULL OR se.staff_id = p_staff_id);
$$;

CREATE OR REPLACE FUNCTION public.get_stylist_financial_totals(
    p_organization_id uuid,
    p_start_date date,
    p_end_date date,
    p_staff_ids uuid[]
)
RETURNS TABLE (
    commission_sum numeric,
    advances_sum numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    WITH commission_total AS (
        SELECT COALESCE(SUM(se.commission_amount), 0) AS commission_sum
        FROM public.staff_earnings se
        WHERE se.organization_id = p_organization_id
          AND se.staff_id = ANY(p_staff_ids)
          AND se.date >= p_start_date
          AND se.date <= p_end_date
    ),
    advance_total AS (
        SELECT COALESCE(SUM(ssa.amount), 0) AS advances_sum
        FROM public.staff_salary_advances ssa
        WHERE ssa.organization_id = p_organization_id
          AND ssa.staff_id = ANY(p_staff_ids)
          AND ssa.created_at >= p_start_date::timestamp
          AND ssa.created_at < (p_end_date + 1)::timestamp
    )
    SELECT ct.commission_sum, at.advances_sum
    FROM commission_total ct
    CROSS JOIN advance_total at;
$$;

REVOKE ALL ON FUNCTION public.get_invoice_summary(uuid, date, date, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_petty_cash_summary(uuid, date, date, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_staff_earnings_totals(uuid, date, date, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_stylist_financial_totals(uuid, date, date, uuid[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_invoice_summary(uuid, date, date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_petty_cash_summary(uuid, date, date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_earnings_totals(uuid, date, date, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stylist_financial_totals(uuid, date, date, uuid[]) TO authenticated;
