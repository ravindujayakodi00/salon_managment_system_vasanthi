-- =============================================================================
-- New salon: Dione
-- Run in Supabase SQL Editor (postgres role — bypasses RLS).
-- Prerequisites: migrations through 20260404 (branding) applied; default org exists.
-- Optional: 20260403 adds salon_settings.max_full_day_holidays_per_year — this script
-- works with or without that column.
-- =============================================================================

-- If slug "dione" is already taken, change the slug below before running.

DO $$
DECLARE
  v_default uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  v_dione   uuid;
BEGIN
  -- Dione: explicit black & white (grayscale) brand; other orgs keep defaults or their saved colors.
  INSERT INTO public.organizations (
    name,
    slug,
    is_active,
    display_name,
    tagline,
    primary_color,
    secondary_color
  )
  VALUES (
    'Dione',
    'dione',
    true,
    'Dione',
    'Salon Management',
    '#000000',
    '#737373'
  )
  RETURNING id INTO v_dione;

  -- salon_settings (copy from default tenant; column set only if migration 20260403 applied)
  IF EXISTS (SELECT 1 FROM public.salon_settings WHERE organization_id = v_default) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'salon_settings'
        AND column_name = 'max_full_day_holidays_per_year'
    ) THEN
      INSERT INTO public.salon_settings (
        slot_interval,
        booking_window_days,
        booking_buffer_minutes,
        default_start_time,
        default_end_time,
        enable_tax,
        tax_rate,
        max_full_day_holidays_per_year,
        organization_id
      )
      SELECT
        slot_interval,
        booking_window_days,
        booking_buffer_minutes,
        default_start_time,
        default_end_time,
        enable_tax,
        tax_rate,
        max_full_day_holidays_per_year,
        v_dione
      FROM public.salon_settings
      WHERE organization_id = v_default
      LIMIT 1;
    ELSE
      INSERT INTO public.salon_settings (
        slot_interval,
        booking_window_days,
        booking_buffer_minutes,
        default_start_time,
        default_end_time,
        enable_tax,
        tax_rate,
        organization_id
      )
      SELECT
        slot_interval,
        booking_window_days,
        booking_buffer_minutes,
        default_start_time,
        default_end_time,
        enable_tax,
        tax_rate,
        v_dione
      FROM public.salon_settings
      WHERE organization_id = v_default
      LIMIT 1;
    END IF;
  ELSE
    INSERT INTO public.salon_settings (organization_id)
    VALUES (v_dione);
  END IF;

  -- commission_settings (per org after 20260404)
  IF EXISTS (
    SELECT 1 FROM public.commission_settings WHERE organization_id = v_default LIMIT 1
  ) THEN
    INSERT INTO public.commission_settings (role, commission_percentage, applies_to, is_active, organization_id)
    SELECT role, commission_percentage, applies_to, is_active, v_dione
    FROM public.commission_settings
    WHERE organization_id = v_default;
  ELSE
    INSERT INTO public.commission_settings (role, commission_percentage, applies_to, organization_id) VALUES
      ('Stylist', 40, 'services', v_dione),
      ('Manager', 0, 'services', v_dione),
      ('Receptionist', 0, 'services', v_dione),
      ('Owner', 0, 'services', v_dione);
  END IF;

  -- notification templates (per org after 20260404)
  IF EXISTS (
    SELECT 1 FROM public.notification_templates WHERE organization_id = v_default LIMIT 1
  ) THEN
    INSERT INTO public.notification_templates (
      name, type, channel, subject, message, is_active, organization_id
    )
    SELECT name, type, channel, subject, message, is_active, v_dione
    FROM public.notification_templates
    WHERE organization_id = v_default;
  ELSE
    INSERT INTO public.notification_templates (name, type, channel, message, organization_id) VALUES
      ('Appointment Confirmation', 'appointment_confirmation', 'sms',
       'Hi {customer_name}! Your appointment is confirmed for {date} at {time}.', v_dione),
      ('Appointment Reminder', 'appointment_reminder', 'sms',
       'Reminder: appointment at {time}.', v_dione),
      ('Appointment Cancellation', 'appointment_cancellation', 'sms',
       'Your appointment on {date} has been cancelled.', v_dione),
      ('Promotional', 'promotional', 'sms',
       'Hi {customer_name}! Special offer for you.', v_dione);
  END IF;

  -- loyalty_settings (optional)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loyalty_settings')
     AND EXISTS (SELECT 1 FROM public.loyalty_settings WHERE organization_id = v_default LIMIT 1) THEN
    INSERT INTO public.loyalty_settings (
      option_card_enabled,
      option_points_enabled,
      option_visits_enabled,
      card_price,
      card_discount_percent,
      card_validity_days,
      points_threshold_amount,
      points_redemption_value,
      visit_reward_frequency,
      visit_reward_discount_percent,
      organization_id
    )
    SELECT
      option_card_enabled,
      option_points_enabled,
      option_visits_enabled,
      card_price,
      card_discount_percent,
      card_validity_days,
      points_threshold_amount,
      points_redemption_value,
      visit_reward_frequency,
      visit_reward_discount_percent,
      v_dione
    FROM public.loyalty_settings
    WHERE organization_id = v_default
    LIMIT 1;
  END IF;

  -- page access matrix (optional)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_page_access')
     AND EXISTS (SELECT 1 FROM public.organization_page_access WHERE organization_id = v_default LIMIT 1) THEN
    INSERT INTO public.organization_page_access (organization_id, role, page_key, allowed)
    SELECT v_dione, role, page_key, allowed
    FROM public.organization_page_access
    WHERE organization_id = v_default;
  END IF;

  -- First branch (edit address/phone in SQL Editor after run)
  INSERT INTO public.branches (name, address, phone, organization_id, is_active)
  VALUES (
    'Dione Main',
    'Update address in Dashboard → Settings → Branches or edit this row',
    '0000000000',
    v_dione,
    true
  );

  RAISE NOTICE 'Dione organization_id = % — use this in profiles.organization_id for the Owner user.', v_dione;
END $$;

-- =============================================================================
-- Next steps (manual)
-- =============================================================================
-- 1. Authentication → Users → Add user (email/password, auto-confirm).
-- 2. Copy the new user's UUID from the Users list.
-- 3. Run (replace UUIDs and email):
--
-- INSERT INTO public.profiles (id, email, name, role, organization_id, is_active)
-- VALUES (
--   'PASTE_AUTH_USER_UUID',
--   'owner@dione.example.com',
--   'Dione Owner',
--   'Owner',
--   'PASTE_DIONE_ORG_UUID_FROM_NOTICE_ABOVE',
--   true
-- );
--
-- 4. Log in to the admin app as that Owner; update branch address/phone as needed.
--
-- If Dione was created before branding columns existed, force B&W seeds:
--   UPDATE public.organizations
--   SET primary_color = '#000000', secondary_color = '#737373', display_name = COALESCE(display_name, 'Dione')
--   WHERE slug = 'dione';
-- =============================================================================
