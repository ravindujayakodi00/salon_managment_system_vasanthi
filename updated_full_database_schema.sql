-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.appointments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  customer_id uuid NOT NULL,
  stylist_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  services ARRAY NOT NULL CHECK (array_length(services, 1) > 0),
  appointment_date date NOT NULL,
  start_time time without time zone NOT NULL,
  duration integer NOT NULL CHECK (duration > 0 AND duration <= 480),
  status text NOT NULL DEFAULT 'Pending'::text CHECK (status = ANY (ARRAY['Pending'::text, 'InProgress'::text, 'Completed'::text, 'Cancelled'::text])),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT appointments_pkey PRIMARY KEY (id),
  CONSTRAINT appointments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT appointments_stylist_id_fkey FOREIGN KEY (stylist_id) REFERENCES public.staff(id),
  CONSTRAINT appointments_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT appointments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.booking_otps (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  phone text NOT NULL,
  otp text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  verified boolean DEFAULT false,
  attempts integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT booking_otps_pkey PRIMARY KEY (id)
);
CREATE TABLE public.bot_sessions (
  phone_number text NOT NULL,
  status text DEFAULT 'MENU'::text,
  temp_data jsonb DEFAULT '{}'::jsonb,
  last_updated timestamp with time zone DEFAULT now(),
  conversation_history jsonb DEFAULT '[]'::jsonb,
  customer_id uuid,
  context jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT bot_sessions_pkey PRIMARY KEY (phone_number),
  CONSTRAINT bot_sessions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);
CREATE TABLE public.branches (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  address text NOT NULL,
  phone text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT branches_pkey PRIMARY KEY (id),
  CONSTRAINT branches_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.campaign_sends (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  campaign_id uuid,
  customer_id uuid,
  channel text NOT NULL,
  message_content text,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'failed'::text])),
  sent_at timestamp with time zone,
  delivered_at timestamp with time zone,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT campaign_sends_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_sends_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT campaign_sends_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT campaign_sends_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.campaigns (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  template_id uuid,
  target_segments ARRAY DEFAULT '{}'::text[],
  scheduled_for timestamp with time zone,
  status text DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sending'::text, 'completed'::text, 'cancelled'::text, 'failed'::text])),
  channel text DEFAULT 'sms'::text CHECK (channel = ANY (ARRAY['sms'::text, 'email'::text, 'both'::text])),
  target_count integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  delivered_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  estimated_cost numeric DEFAULT 0,
  actual_cost numeric DEFAULT 0,
  cost_per_message numeric DEFAULT 2.00,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  sent_at timestamp with time zone,
  completed_at timestamp with time zone,
  organization_id uuid NOT NULL,
  CONSTRAINT campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT campaigns_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.caption_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  caption text NOT NULL,
  hashtags text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT caption_templates_pkey PRIMARY KEY (id)
);
CREATE TABLE public.commission_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  role text NOT NULL,
  commission_percentage numeric DEFAULT 0,
  applies_to text DEFAULT 'services'::text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT commission_settings_pkey PRIMARY KEY (id),
  CONSTRAINT commission_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.customer_loyalty (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid UNIQUE,
  loyalty_card_id uuid,
  total_points integer DEFAULT 0,
  redeemed_points integer DEFAULT 0,
  total_visits integer DEFAULT 0,
  last_reward_visit integer DEFAULT 0,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT customer_loyalty_pkey PRIMARY KEY (id),
  CONSTRAINT customer_loyalty_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT customer_loyalty_loyalty_card_id_fkey FOREIGN KEY (loyalty_card_id) REFERENCES public.loyalty_cards(id),
  CONSTRAINT customer_loyalty_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.customer_segments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  description text,
  color text DEFAULT '#6366f1'::text,
  icon text DEFAULT 'users'::text,
  auto_criteria jsonb,
  is_active boolean DEFAULT true,
  customer_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT customer_segments_pkey PRIMARY KEY (id),
  CONSTRAINT customer_segments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  gender text CHECK (gender = ANY (ARRAY['Male'::text, 'Female'::text, 'Other'::text])),
  total_visits integer DEFAULT 0,
  total_spent numeric DEFAULT 0,
  last_visit timestamp with time zone,
  preferences text,
  created_at timestamp with time zone DEFAULT now(),
  segment_tags ARRAY DEFAULT '{}'::text[],
  last_visit_date date,
  preferred_services ARRAY DEFAULT '{}'::text[],
  is_active boolean DEFAULT true,
  organization_id uuid NOT NULL,
  CONSTRAINT customers_pkey PRIMARY KEY (id),
  CONSTRAINT customers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.inventory (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  category character varying NOT NULL DEFAULT 'Supplies'::character varying,
  description text,
  sku character varying UNIQUE,
  current_stock integer NOT NULL DEFAULT 0,
  min_stock_level integer DEFAULT 10,
  unit character varying DEFAULT 'units'::character varying,
  cost_per_unit numeric DEFAULT 0,
  selling_price numeric DEFAULT 0,
  supplier character varying,
  last_restocked_at timestamp without time zone,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT inventory_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.inventory_transactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  inventory_id uuid,
  transaction_type character varying NOT NULL,
  quantity integer NOT NULL,
  reference_id uuid,
  notes text,
  created_by uuid,
  created_at timestamp without time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_transactions_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id),
  CONSTRAINT inventory_transactions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  invoice_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  appointment_id uuid,
  items jsonb NOT NULL,
  subtotal numeric NOT NULL,
  discount numeric DEFAULT 0,
  promo_code text,
  tax numeric DEFAULT 0,
  total numeric NOT NULL,
  payment_method text NOT NULL CHECK (payment_method = ANY (ARRAY['Cash'::text, 'Card'::text, 'BankTransfer'::text, 'UPI'::text, 'Other'::text])),
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  payment_breakdown jsonb DEFAULT '[]'::jsonb CHECK (payment_breakdown IS NULL OR jsonb_typeof(payment_breakdown) = 'array'::text),
  organization_id uuid NOT NULL,
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT invoices_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT invoices_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id),
  CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.loyalty_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  card_number character varying NOT NULL UNIQUE,
  status character varying DEFAULT 'available'::character varying,
  customer_id uuid,
  sold_at timestamp without time zone,
  sold_by uuid,
  expiry_date date,
  purchase_price numeric,
  discount_percent numeric,
  invoice_id uuid,
  created_at timestamp without time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT loyalty_cards_pkey PRIMARY KEY (id),
  CONSTRAINT loyalty_cards_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT loyalty_cards_sold_by_fkey FOREIGN KEY (sold_by) REFERENCES public.staff(id),
  CONSTRAINT loyalty_cards_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.loyalty_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  option_card_enabled boolean DEFAULT false,
  option_points_enabled boolean DEFAULT false,
  option_visits_enabled boolean DEFAULT false,
  card_price numeric DEFAULT 15000,
  card_discount_percent numeric DEFAULT 10,
  card_validity_days integer DEFAULT 365,
  points_threshold_amount numeric DEFAULT 200,
  points_redemption_value numeric DEFAULT 10,
  visit_reward_frequency integer DEFAULT 5,
  visit_reward_discount_percent numeric DEFAULT 15,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT loyalty_settings_pkey PRIMARY KEY (id),
  CONSTRAINT loyalty_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.loyalty_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid,
  type character varying NOT NULL,
  amount numeric,
  invoice_id uuid,
  description text,
  created_at timestamp without time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT loyalty_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT loyalty_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT loyalty_transactions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.notification_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  channel text NOT NULL CHECK (channel = ANY (ARRAY['sms'::text, 'email'::text, 'both'::text])),
  subject text,
  message text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT notification_templates_pkey PRIMARY KEY (id),
  CONSTRAINT notification_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.organization_page_access (
  organization_id uuid NOT NULL,
  role text NOT NULL,
  page_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT organization_page_access_pkey PRIMARY KEY (organization_id, role, page_key),
  CONSTRAINT organization_page_access_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.organization_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  display_name text NOT NULL,
  system_role text NOT NULL CHECK (system_role = ANY (ARRAY['Owner'::text, 'Manager'::text, 'Receptionist'::text, 'Stylist'::text])),
  is_deletable boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT organization_roles_pkey PRIMARY KEY (id),
  CONSTRAINT organization_roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  display_name text,
  tagline text,
  logo_url text,
  favicon_url text,
  primary_color text DEFAULT '#4B5945'::text,
  secondary_color text DEFAULT '#0d9488'::text,
  accent_color text,
  contact_email text,
  contact_phone text,
  timezone text DEFAULT 'Asia/Colombo'::text,
  CONSTRAINT organizations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.password_change_otps (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  otp text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT password_change_otps_pkey PRIMARY KEY (id),
  CONSTRAINT password_change_otps_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.petty_cash_transactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  type text NOT NULL CHECK (type = ANY (ARRAY['deposit'::text, 'withdrawal'::text])),
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  description text NOT NULL,
  balance_after numeric NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  branch_id uuid,
  updated_at timestamp with time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT petty_cash_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT petty_cash_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT petty_cash_transactions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT petty_cash_transactions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.posting_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slot_order integer NOT NULL,
  posting_time time without time zone NOT NULL,
  caption_template_id uuid,
  custom_caption text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT posting_slots_pkey PRIMARY KEY (id),
  CONSTRAINT posting_slots_caption_template_id_fkey FOREIGN KEY (caption_template_id) REFERENCES public.caption_templates(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role text,
  branch_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  organization_id uuid NOT NULL DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid,
  system_role text NOT NULL CHECK (system_role = ANY (ARRAY['Owner'::text, 'Manager'::text, 'Receptionist'::text, 'Stylist'::text])),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.promo_codes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  code text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type = ANY (ARRAY['percentage'::text, 'fixed'::text])),
  value numeric NOT NULL,
  min_spend numeric DEFAULT 0,
  start_date date NOT NULL,
  end_date date NOT NULL,
  usage_limit integer,
  used_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT promo_codes_pkey PRIMARY KEY (id),
  CONSTRAINT promo_codes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.salary_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  staff_id uuid NOT NULL,
  salary_type text NOT NULL CHECK (salary_type = ANY (ARRAY['daily'::text, 'monthly'::text])),
  amount numeric NOT NULL,
  effective_from date NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT salary_settings_pkey PRIMARY KEY (id),
  CONSTRAINT salary_settings_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id),
  CONSTRAINT salary_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.salon_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  slot_interval integer DEFAULT 30 CHECK (slot_interval = ANY (ARRAY[15, 30, 60])),
  booking_window_days integer DEFAULT 30 CHECK (booking_window_days > 0),
  booking_buffer_minutes integer DEFAULT 10 CHECK (booking_buffer_minutes >= 0),
  default_start_time time without time zone DEFAULT '09:00:00'::time without time zone,
  default_end_time time without time zone DEFAULT '18:00:00'::time without time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  enable_tax boolean DEFAULT false,
  tax_rate numeric DEFAULT 0,
  organization_id uuid NOT NULL,
  max_full_day_holidays_per_year integer CHECK (max_full_day_holidays_per_year IS NULL OR max_full_day_holidays_per_year >= 0),
  CONSTRAINT salon_settings_pkey PRIMARY KEY (id),
  CONSTRAINT salon_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.service_embeddings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  service_id uuid UNIQUE,
  content text,
  updated_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding USER-DEFINED,
  CONSTRAINT service_embeddings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  category text NOT NULL,
  price numeric NOT NULL,
  duration integer NOT NULL,
  gender text CHECK (gender = ANY (ARRAY['Male'::text, 'Female'::text, 'Unisex'::text])),
  is_active boolean DEFAULT true,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT services_pkey PRIMARY KEY (id),
  CONSTRAINT services_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.social_media_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  facebook_page_id character varying,
  facebook_page_token character varying,
  instagram_account_id character varying,
  is_connected boolean DEFAULT false,
  facebook_enabled boolean DEFAULT true,
  instagram_enabled boolean DEFAULT false,
  logo_url character varying,
  logo_position character varying DEFAULT 'bottom-right'::character varying,
  logo_size integer DEFAULT 80,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_automation_run timestamp with time zone,
  CONSTRAINT social_media_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.staff (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  profile_id uuid,
  name text NOT NULL,
  email text,
  phone text NOT NULL,
  role text,
  branch_id uuid,
  specializations ARRAY DEFAULT '{}'::uuid[],
  working_days ARRAY DEFAULT '{}'::text[],
  working_hours jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  is_emergency_unavailable boolean DEFAULT false,
  commission numeric DEFAULT NULL::numeric,
  organization_id uuid NOT NULL,
  system_role text NOT NULL CHECK (system_role = ANY (ARRAY['Owner'::text, 'Manager'::text, 'Receptionist'::text, 'Stylist'::text])),
  salary numeric DEFAULT NULL::numeric,
  CONSTRAINT staff_pkey PRIMARY KEY (id),
  CONSTRAINT staff_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT staff_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT staff_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.staff_earnings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  staff_id uuid NOT NULL,
  date date NOT NULL,
  service_revenue numeric DEFAULT 0,
  commission_amount numeric DEFAULT 0,
  salary_amount numeric DEFAULT 0,
  total_earnings numeric DEFAULT 0,
  appointments_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT staff_earnings_pkey PRIMARY KEY (id),
  CONSTRAINT staff_earnings_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id),
  CONSTRAINT staff_earnings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.staff_salary_advances (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  staff_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  description text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT staff_salary_advances_pkey PRIMARY KEY (id),
  CONSTRAINT staff_salary_advances_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id),
  CONSTRAINT staff_salary_advances_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT staff_salary_advances_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.story_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  image_url character varying NOT NULL,
  processed_url character varying,
  caption text,
  caption_template_id uuid,
  use_slot_caption boolean DEFAULT true,
  status character varying DEFAULT 'pending'::character varying,
  scheduled_date date,
  scheduled_time time without time zone,
  slot_id uuid,
  posted_at timestamp with time zone,
  facebook_post_id character varying,
  instagram_post_id character varying,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT story_images_pkey PRIMARY KEY (id),
  CONSTRAINT story_images_caption_template_id_fkey FOREIGN KEY (caption_template_id) REFERENCES public.caption_templates(id),
  CONSTRAINT story_images_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.posting_slots(id)
);
CREATE TABLE public.story_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  enabled boolean DEFAULT true,
  posting_days ARRAY DEFAULT ARRAY['Monday'::text, 'Tuesday'::text, 'Wednesday'::text, 'Thursday'::text, 'Friday'::text],
  daily_post_limit integer DEFAULT 3,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT story_schedule_pkey PRIMARY KEY (id)
);
CREATE TABLE public.stylist_availability (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  stylist_id uuid NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['holiday'::text, 'half_day'::text, 'emergency'::text, 'break'::text, 'other'::text])),
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT stylist_availability_pkey PRIMARY KEY (id),
  CONSTRAINT stylist_availability_stylist_id_fkey FOREIGN KEY (stylist_id) REFERENCES public.staff(id),
  CONSTRAINT stylist_availability_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.stylist_breaks (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  stylist_id uuid NOT NULL,
  day_of_week integer CHECK (day_of_week >= 0 AND day_of_week <= 6 OR day_of_week IS NULL),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  break_type text DEFAULT 'Lunch'::text CHECK (break_type = ANY (ARRAY['Lunch'::text, 'Short'::text, 'Personal'::text, 'Other'::text])),
  is_recurring boolean DEFAULT true,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT stylist_breaks_pkey PRIMARY KEY (id),
  CONSTRAINT stylist_breaks_stylist_id_fkey FOREIGN KEY (stylist_id) REFERENCES public.staff(id),
  CONSTRAINT stylist_breaks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.stylist_embeddings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  stylist_id uuid UNIQUE,
  content text,
  updated_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding USER-DEFINED,
  CONSTRAINT stylist_embeddings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.stylist_unavailability (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  stylist_id uuid NOT NULL,
  unavailable_date date NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  organization_id uuid NOT NULL,
  CONSTRAINT stylist_unavailability_pkey PRIMARY KEY (id),
  CONSTRAINT stylist_unavailability_stylist_id_fkey FOREIGN KEY (stylist_id) REFERENCES public.staff(id),
  CONSTRAINT stylist_unavailability_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);