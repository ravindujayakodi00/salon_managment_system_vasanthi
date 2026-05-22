-- =============================================================================
-- Migration: Link staff_earnings to invoices and appointments
--
-- Problem: staff_earnings was a daily aggregate table (one row per staff per
-- day). This meant multiple invoices on the same day were merged into one row,
-- making it impossible to trace which invoice generated which earning, or to
-- reverse an earning when an invoice is refunded.
--
-- Solution: Change to one row per invoice per staff member.
--   - Add invoice_id FK → invoices(id)
--   - Add appointment_id FK → appointments(id)
--   - Drop the UNIQUE(organization_id, staff_id, date) constraint
--   - Add partial unique indexes:
--       • One earning per invoice per staff  (invoice_id IS NOT NULL)
--       • One salary row per staff per date  (invoice_id IS NULL)
-- =============================================================================

-- 1. Add new FK columns (nullable — salary rows have no invoice)
ALTER TABLE public.staff_earnings
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL;

-- 2. Drop the old daily-aggregate unique constraints
ALTER TABLE public.staff_earnings
  DROP CONSTRAINT IF EXISTS staff_earnings_organization_id_staff_id_date_key;

ALTER TABLE public.staff_earnings
  DROP CONSTRAINT IF EXISTS staff_earnings_staff_id_date_key;

-- 3. Partial unique indexes
--    a) One earning row per invoice per staff (service/commission earnings)
CREATE UNIQUE INDEX IF NOT EXISTS staff_earnings_invoice_unique
  ON public.staff_earnings (organization_id, staff_id, invoice_id)
  WHERE invoice_id IS NOT NULL;

--    b) One salary row per staff per date (salary records have no invoice)
CREATE UNIQUE INDEX IF NOT EXISTS staff_earnings_salary_date_unique
  ON public.staff_earnings (organization_id, staff_id, date)
  WHERE invoice_id IS NULL;

-- 4. Indexes on new FK columns for JOIN performance
CREATE INDEX IF NOT EXISTS idx_staff_earnings_invoice_id
  ON public.staff_earnings (invoice_id);

CREATE INDEX IF NOT EXISTS idx_staff_earnings_appointment_id
  ON public.staff_earnings (appointment_id);
