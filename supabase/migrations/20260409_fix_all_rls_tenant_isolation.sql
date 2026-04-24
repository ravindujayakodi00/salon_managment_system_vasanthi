-- =============================================================================
-- Nuclear RLS reset: drop ALL policies on tenant tables, then recreate only
-- org-scoped (or staff-join scoped) policies. Fixes permissive USING(true)
-- policies from legacy scripts stacking with OR and leaking cross-tenant data.
-- =============================================================================

DO $$
DECLARE
  t text;
  r record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations',
    'profiles',
    'branches',
    'customers',
    'services',
    'staff',
    'appointments',
    'invoices',
    'promo_codes',
    'petty_cash_transactions',
    'salon_settings',
    'stylist_breaks',
    'stylist_availability',
    'stylist_unavailability',
    'campaigns',
    'campaign_sends',
    'customer_segments',
    'in_app_notifications',
    'in_app_notification_recipients',
    'inventory',
    'inventory_transactions',
    'loyalty_cards',
    'customer_loyalty',
    'loyalty_settings',
    'loyalty_transactions',
    'notification_templates',
    'commission_settings',
    'organization_page_access',
    'staff_earnings',
    'salary_settings',
    'staff_salary_advances'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      FOR r IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- organizations
-- =============================================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select_member"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "org_update_owner_same"
  ON public.organizations FOR UPDATE TO authenticated
  USING (
    id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'Owner')
  );

-- =============================================================================
-- profiles
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_insert_self"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_select_self_or_mgr"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (
      EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid()
          AND me.role IN ('Owner', 'Manager')
          AND me.organization_id = profiles.organization_id
      )
    )
  );

CREATE POLICY "profiles_update_self"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- =============================================================================
-- branches
-- =============================================================================
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branches_select_org"
  ON public.branches FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "branches_insert_mgr"
  ON public.branches FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager')
    )
  );

CREATE POLICY "branches_update_mgr"
  ON public.branches FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager')
    )
  );

CREATE POLICY "branches_delete_owner"
  ON public.branches FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'Owner'
    )
  );

-- =============================================================================
-- customers
-- =============================================================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_all_org"
  ON public.customers FOR ALL TO authenticated
  USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()))
  WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

-- =============================================================================
-- services
-- =============================================================================
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_select_org"
  ON public.services FOR SELECT TO authenticated
  USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "services_insert_mgr"
  ON public.services FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager')
    )
  );

CREATE POLICY "services_update_mgr"
  ON public.services FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager')
    )
  )
  WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "services_delete_mgr"
  ON public.services FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager')
    )
  );

-- =============================================================================
-- staff (branch-bound select; Owner-only insert/delete per 20260329 branch_bound)
-- =============================================================================
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_org"
  ON public.staff FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid() AND me.role = 'Owner'
      )
      OR staff.branch_id = (SELECT p.branch_id FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

CREATE POLICY "staff_insert_owner"
  ON public.staff FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'Owner'
    )
    AND EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = branch_id AND b.organization_id = public.staff.organization_id
    )
  );

CREATE POLICY "staff_delete_owner"
  ON public.staff FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'Owner'
    )
  );

CREATE POLICY "staff_update_mgr_or_self_emergency"
  ON public.staff FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid() AND me.role = 'Owner'
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.profiles me
          WHERE me.id = auth.uid()
            AND me.role = 'Manager'
            AND me.branch_id = staff.branch_id
        )
      )
      OR profile_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- =============================================================================
-- appointments (branch-bound)
-- =============================================================================
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_select_org"
  ON public.appointments FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid() AND me.role = 'Owner'
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid()
          AND me.role = 'Manager'
          AND me.branch_id = appointments.branch_id
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid()
          AND me.role = 'Receptionist'
          AND me.branch_id = appointments.branch_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.staff s
        WHERE s.profile_id = auth.uid()
          AND s.id = appointments.stylist_id
          AND s.branch_id = appointments.branch_id
      )
    )
  );

CREATE POLICY "appointments_insert_org"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid()
        AND p2.role IN ('Owner', 'Manager', 'Receptionist')
        AND (
          p2.role = 'Owner'
          OR p2.branch_id = appointments.branch_id
        )
    )
    AND EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = branch_id AND b.organization_id = appointments.organization_id
    )
  );

CREATE POLICY "appointments_update_org"
  ON public.appointments FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid()
          AND me.role IN ('Owner', 'Manager', 'Receptionist')
          AND (
            me.role = 'Owner'
            OR me.branch_id = appointments.branch_id
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.staff s
        WHERE s.profile_id = auth.uid()
          AND s.id = appointments.stylist_id
          AND s.branch_id = appointments.branch_id
      )
    )
  )
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "appointments_delete_mgr"
  ON public.appointments FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid() AND me.role = 'Owner'
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid()
          AND me.role = 'Manager'
          AND me.branch_id = appointments.branch_id
      )
    )
  );

-- =============================================================================
-- invoices (branch-bound)
-- =============================================================================
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_all_org"
  ON public.invoices FOR ALL TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid() AND me.role = 'Owner'
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid()
          AND me.role IN ('Manager', 'Receptionist', 'Stylist')
          AND me.branch_id = invoices.branch_id
      )
    )
  )
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid() AND me.role = 'Owner'
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid()
          AND me.role IN ('Manager', 'Receptionist', 'Stylist')
          AND me.branch_id = branch_id
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = branch_id AND b.organization_id = invoices.organization_id
    )
  );

-- =============================================================================
-- promo_codes
-- =============================================================================
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo_select_org"
  ON public.promo_codes FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      is_active = true
      OR EXISTS (
        SELECT 1 FROM public.profiles p2
        WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager')
      )
    )
  );

CREATE POLICY "promo_insert_mgr"
  ON public.promo_codes FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager'))
  );

CREATE POLICY "promo_update_mgr"
  ON public.promo_codes FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager'))
  )
  WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "promo_delete_mgr"
  ON public.promo_codes FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager'))
  );

-- =============================================================================
-- petty_cash_transactions (branch-bound)
-- =============================================================================
ALTER TABLE public.petty_cash_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "petty_cash_select_org"
  ON public.petty_cash_transactions FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid() AND me.role = 'Owner'
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid()
          AND me.role IN ('Manager', 'Receptionist')
          AND me.branch_id = petty_cash_transactions.branch_id
      )
    )
  );

CREATE POLICY "petty_cash_insert_org"
  ON public.petty_cash_transactions FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid() AND me.role = 'Owner'
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid()
          AND me.role IN ('Manager', 'Receptionist')
          AND me.branch_id = branch_id
      )
    )
  );

CREATE POLICY "petty_cash_delete_mgr"
  ON public.petty_cash_transactions FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid() AND me.role = 'Owner'
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid()
          AND me.role IN ('Manager', 'Receptionist')
          AND me.branch_id = petty_cash_transactions.branch_id
      )
    )
  );

-- =============================================================================
-- salon_settings
-- =============================================================================
ALTER TABLE public.salon_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salon_settings_select_org"
  ON public.salon_settings FOR SELECT TO authenticated
  USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "salon_settings_insert_owner"
  ON public.salon_settings FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'Owner')
  );

CREATE POLICY "salon_settings_update_owner"
  ON public.salon_settings FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'Owner')
  )
  WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "salon_settings_delete_owner"
  ON public.salon_settings FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'Owner')
  );

-- =============================================================================
-- stylist_breaks (via staff.organization_id)
-- =============================================================================
ALTER TABLE public.stylist_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stylist_breaks_select_org"
  ON public.stylist_breaks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = stylist_breaks.stylist_id
        AND s.organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

CREATE POLICY "stylist_breaks_mutate_own_or_owner"
  ON public.stylist_breaks FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = stylist_breaks.stylist_id
        AND s.organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
        AND (
          s.profile_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p2
            WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = stylist_breaks.stylist_id
        AND s.organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

-- =============================================================================
-- stylist_availability (optional table)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stylist_availability'
  ) THEN
    ALTER TABLE public.stylist_availability ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "stylist_availability_select_org"
      ON public.stylist_availability FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.staff s
          WHERE s.id = stylist_availability.stylist_id
            AND s.organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
        )
      );

    CREATE POLICY "stylist_availability_mutate_org"
      ON public.stylist_availability FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.staff s
          WHERE s.id = stylist_availability.stylist_id
            AND s.organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
            AND (
              s.profile_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.profiles p2
                WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager')
              )
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.staff s
          WHERE s.id = stylist_availability.stylist_id
            AND s.organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
        )
      );
  END IF;
END $$;

-- =============================================================================
-- stylist_unavailability (optional table)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stylist_unavailability'
  ) THEN
    ALTER TABLE public.stylist_unavailability ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "stylist_unavailability_select_org"
      ON public.stylist_unavailability FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.staff s
          WHERE s.id = stylist_unavailability.stylist_id
            AND s.organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
        )
      );

    CREATE POLICY "stylist_unavailability_mutate_org"
      ON public.stylist_unavailability FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.staff s
          WHERE s.id = stylist_unavailability.stylist_id
            AND s.organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
            AND (
              s.profile_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.profiles p2
                WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager')
              )
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.staff s
          WHERE s.id = stylist_unavailability.stylist_id
            AND s.organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
        )
      );
  END IF;
END $$;

-- =============================================================================
-- campaigns, campaign_sends
-- =============================================================================
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_select_org"
  ON public.campaigns FOR SELECT TO authenticated
  USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "campaigns_insert_mgr"
  ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager'))
  );

CREATE POLICY "campaigns_update_mgr"
  ON public.campaigns FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager'))
  )
  WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "campaigns_delete_mgr"
  ON public.campaigns FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager'))
  );

ALTER TABLE public.campaign_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_sends_select_org"
  ON public.campaign_sends FOR SELECT TO authenticated
  USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "campaign_sends_insert_mgr"
  ON public.campaign_sends FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager'))
  );

CREATE POLICY "campaign_sends_update_mgr"
  ON public.campaign_sends FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager'))
  )
  WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "campaign_sends_delete_mgr"
  ON public.campaign_sends FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager'))
  );

-- =============================================================================
-- customer_segments
-- =============================================================================
ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "segments_select_org"
  ON public.customer_segments FOR SELECT TO authenticated
  USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "segments_insert_owner"
  ON public.customer_segments FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'Owner')
  );

CREATE POLICY "segments_update_owner"
  ON public.customer_segments FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'Owner')
  )
  WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "segments_delete_owner"
  ON public.customer_segments FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'Owner')
  );

-- =============================================================================
-- in_app_notifications
-- =============================================================================
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "in_app_notifications_select_org"
  ON public.in_app_notifications FOR SELECT TO authenticated
  USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "in_app_notifications_insert_org"
  ON public.in_app_notifications FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

-- =============================================================================
-- in_app_notification_recipients
-- =============================================================================
ALTER TABLE public.in_app_notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "in_app_recipients_select_own"
  ON public.in_app_notification_recipients FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = staff_id
        AND s.organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

CREATE POLICY "in_app_recipients_update_own"
  ON public.in_app_notification_recipients FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = staff_id AND s.profile_id = auth.uid()
    )
  );

CREATE POLICY "in_app_recipients_insert_org"
  ON public.in_app_notification_recipients FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = staff_id
        AND s.organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

-- =============================================================================
-- inventory (optional)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inventory'
  ) THEN
    ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "inventory_all_org"
      ON public.inventory FOR ALL TO authenticated
      USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()))
      WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inventory_transactions'
  ) THEN
    ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "inventory_tx_all_org"
      ON public.inventory_transactions FOR ALL TO authenticated
      USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()))
      WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
  END IF;
END $$;

-- =============================================================================
-- loyalty (optional)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'loyalty_cards'
  ) THEN
    ALTER TABLE public.loyalty_cards ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "loyalty_cards_org"
      ON public.loyalty_cards FOR ALL TO authenticated
      USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()))
      WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'customer_loyalty'
  ) THEN
    ALTER TABLE public.customer_loyalty ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "customer_loyalty_org"
      ON public.customer_loyalty FOR ALL TO authenticated
      USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()))
      WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'loyalty_settings'
  ) THEN
    ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "loyalty_settings_select_org"
      ON public.loyalty_settings FOR SELECT TO authenticated
      USING (
        organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
      );
    CREATE POLICY "loyalty_settings_insert_owner"
      ON public.loyalty_settings FOR INSERT TO authenticated
      WITH CHECK (
        organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'Owner')
      );
    CREATE POLICY "loyalty_settings_update_owner"
      ON public.loyalty_settings FOR UPDATE TO authenticated
      USING (
        organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'Owner')
      )
      WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
    CREATE POLICY "loyalty_settings_delete_owner"
      ON public.loyalty_settings FOR DELETE TO authenticated
      USING (
        organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'Owner')
      );
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'loyalty_transactions'
  ) THEN
    ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "loyalty_transactions_org"
      ON public.loyalty_transactions FOR ALL TO authenticated
      USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()))
      WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));
  END IF;
END $$;

-- =============================================================================
-- notification_templates
-- =============================================================================
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_templates_select_same_org"
  ON public.notification_templates FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "notification_templates_insert_mgr"
  ON public.notification_templates FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager')
    )
  );

CREATE POLICY "notification_templates_update_mgr"
  ON public.notification_templates FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager')
    )
  )
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "notification_templates_delete_mgr"
  ON public.notification_templates FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role IN ('Owner', 'Manager')
    )
  );

-- =============================================================================
-- commission_settings
-- =============================================================================
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission_settings_select_same_org"
  ON public.commission_settings FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "commission_settings_all_owner"
  ON public.commission_settings FOR ALL TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'Owner')
  )
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'Owner')
  );

-- =============================================================================
-- organization_page_access
-- =============================================================================
ALTER TABLE public.organization_page_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_access_select_org"
  ON public.organization_page_access FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "page_access_owner_upsert"
  ON public.organization_page_access FOR ALL TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'Owner'
    )
  )
  WITH CHECK (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = auth.uid() AND p2.role = 'Owner'
    )
  );

-- =============================================================================
-- staff_earnings (no organization_id column — scope via staff)
-- =============================================================================
ALTER TABLE public.staff_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_earnings_select_org"
  ON public.staff_earnings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff s
      JOIN public.profiles me ON me.id = auth.uid()
      WHERE s.id = staff_earnings.staff_id
        AND s.organization_id = me.organization_id
        AND (s.profile_id = me.id OR me.role IN ('Owner', 'Manager'))
    )
  );

CREATE POLICY "staff_earnings_insert_org"
  ON public.staff_earnings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.staff s
      JOIN public.profiles me ON me.id = auth.uid()
      WHERE s.id = staff_id
        AND s.organization_id = me.organization_id
        AND me.role IN ('Owner', 'Manager')
    )
  );

CREATE POLICY "staff_earnings_update_org"
  ON public.staff_earnings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff s
      JOIN public.profiles me ON me.id = auth.uid()
      WHERE s.id = staff_earnings.staff_id
        AND s.organization_id = me.organization_id
        AND me.role IN ('Owner', 'Manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.staff s
      JOIN public.profiles me ON me.id = auth.uid()
      WHERE s.id = staff_earnings.staff_id
        AND s.organization_id = me.organization_id
        AND me.role IN ('Owner', 'Manager')
    )
  );

CREATE POLICY "staff_earnings_delete_org"
  ON public.staff_earnings FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff s
      JOIN public.profiles me ON me.id = auth.uid()
      WHERE s.id = staff_earnings.staff_id
        AND s.organization_id = me.organization_id
        AND me.role IN ('Owner', 'Manager')
    )
  );

-- =============================================================================
-- salary_settings (via staff)
-- =============================================================================
ALTER TABLE public.salary_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salary_settings_select_org"
  ON public.salary_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff s
      JOIN public.profiles me ON me.id = auth.uid()
      WHERE s.id = salary_settings.staff_id
        AND s.organization_id = me.organization_id
        AND (s.profile_id = me.id OR me.role IN ('Owner', 'Manager'))
    )
  );

CREATE POLICY "salary_settings_insert_owner_org"
  ON public.salary_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.staff s
      JOIN public.profiles me ON me.id = auth.uid()
      WHERE s.id = staff_id
        AND s.organization_id = me.organization_id
        AND me.role = 'Owner'
    )
  );

CREATE POLICY "salary_settings_update_owner_org"
  ON public.salary_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff s
      JOIN public.profiles me ON me.id = auth.uid()
      WHERE s.id = salary_settings.staff_id
        AND s.organization_id = me.organization_id
        AND me.role = 'Owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.staff s
      JOIN public.profiles me ON me.id = auth.uid()
      WHERE s.id = salary_settings.staff_id
        AND s.organization_id = me.organization_id
        AND me.role = 'Owner'
    )
  );

CREATE POLICY "salary_settings_delete_owner_org"
  ON public.salary_settings FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff s
      JOIN public.profiles me ON me.id = auth.uid()
      WHERE s.id = salary_settings.staff_id
        AND s.organization_id = me.organization_id
        AND me.role = 'Owner'
    )
  );

-- =============================================================================
-- staff_salary_advances
-- =============================================================================
ALTER TABLE public.staff_salary_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salary_advances_select_mgr_org"
  ON public.staff_salary_advances FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff s
      JOIN public.profiles me ON me.id = auth.uid()
      WHERE s.id = staff_salary_advances.staff_id
        AND s.organization_id = me.organization_id
        AND me.role IN ('Owner', 'Manager')
    )
  );

CREATE POLICY "salary_advances_select_stylist_own"
  ON public.staff_salary_advances FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff s
      WHERE s.id = staff_salary_advances.staff_id
        AND s.profile_id = auth.uid()
    )
  );

CREATE POLICY "salary_advances_insert_mgr_org"
  ON public.staff_salary_advances FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.staff s
      JOIN public.profiles me ON me.id = auth.uid()
      WHERE s.id = staff_id
        AND s.organization_id = me.organization_id
        AND me.role IN ('Owner', 'Manager')
    )
  );

CREATE POLICY "salary_advances_insert_stylist_own"
  ON public.staff_salary_advances FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid() AND me.role = 'Stylist'
    )
    AND staff_id = (
      SELECT s.id FROM public.staff s
      WHERE s.profile_id = auth.uid()
        AND s.role = 'Stylist'
        AND s.is_active = true
      LIMIT 1
    )
  );
