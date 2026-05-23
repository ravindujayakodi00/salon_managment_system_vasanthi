-- ============================================================
-- Migration: Expenses support
-- - New table: expense_categories (global + per-org categories)
-- - Alter table: petty_cash_transactions — add entry_type + expense_category_id
-- ============================================================

-- 1. Create expense_categories table
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name              text        NOT NULL,
    organization_id   uuid        REFERENCES public.organizations(id) ON DELETE CASCADE,
    is_active         boolean     NOT NULL DEFAULT true,
    created_at        timestamptz NOT NULL DEFAULT now()
);

-- 2. Seed global (system-wide) default categories — organization_id = NULL means available to all orgs
INSERT INTO public.expense_categories (name, organization_id) VALUES
    ('Electricity', NULL),
    ('Water',       NULL),
    ('Rent',        NULL)
ON CONFLICT DO NOTHING;

-- 3. Add entry_type to petty_cash_transactions
--    'petty_cash' = existing petty cash records (deposit / small withdrawal)
--    'expense'    = a formal expense linked to a category
ALTER TABLE public.petty_cash_transactions
    ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'petty_cash'
        CHECK (entry_type IN ('petty_cash', 'expense'));

-- 4. Add expense_category_id FK (nullable — only set for entry_type = 'expense')
ALTER TABLE public.petty_cash_transactions
    ADD COLUMN IF NOT EXISTS expense_category_id uuid
        REFERENCES public.expense_categories(id) ON DELETE SET NULL;

-- 5. RLS on expense_categories
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

-- Read: global categories (org IS NULL) OR categories belonging to the user's org
CREATE POLICY "expense_categories_select" ON public.expense_categories
    FOR SELECT USING (
        organization_id IS NULL
        OR organization_id = (
            SELECT organization_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- Insert/Update/Delete: only users in the same org can manage org-specific categories
CREATE POLICY "expense_categories_insert" ON public.expense_categories
    FOR INSERT WITH CHECK (
        organization_id = (
            SELECT organization_id FROM public.profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "expense_categories_update" ON public.expense_categories
    FOR UPDATE USING (
        organization_id = (
            SELECT organization_id FROM public.profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "expense_categories_delete" ON public.expense_categories
    FOR DELETE USING (
        organization_id = (
            SELECT organization_id FROM public.profiles WHERE id = auth.uid()
        )
    );
