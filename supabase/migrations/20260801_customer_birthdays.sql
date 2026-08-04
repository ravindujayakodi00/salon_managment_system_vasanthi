-- Customer dates of birth and idempotent birthday SMS delivery.

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS date_of_birth date;

CREATE INDEX IF NOT EXISTS idx_customers_birth_month_day
ON public.customers (
    (EXTRACT(MONTH FROM date_of_birth)),
    (EXTRACT(DAY FROM date_of_birth))
)
WHERE date_of_birth IS NOT NULL AND is_active = true;

CREATE TABLE IF NOT EXISTS public.birthday_message_sends (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    birthday_year integer NOT NULL,
    status text NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'sent', 'failed')),
    attempt_count integer NOT NULL DEFAULT 1,
    provider_message_id text,
    error_message text,
    last_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
    sent_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT birthday_message_sends_customer_year_key UNIQUE (customer_id, birthday_year)
);

CREATE INDEX IF NOT EXISTS idx_birthday_message_sends_org_year
ON public.birthday_message_sends (organization_id, birthday_year, status);

ALTER TABLE public.birthday_message_sends ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_birthday_customers(
    p_organization_id uuid,
    p_date date
)
RETURNS TABLE (
    id uuid,
    name text,
    phone text,
    date_of_birth date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT c.id, c.name, c.phone, c.date_of_birth
    FROM public.customers c
    WHERE c.organization_id = p_organization_id
      AND c.is_active = true
      AND c.date_of_birth IS NOT NULL
      AND c.phone IS NOT NULL
      AND c.phone <> ''
      AND (
          (
              EXTRACT(MONTH FROM c.date_of_birth) = EXTRACT(MONTH FROM p_date)
              AND EXTRACT(DAY FROM c.date_of_birth) = EXTRACT(DAY FROM p_date)
          )
          OR (
              EXTRACT(MONTH FROM c.date_of_birth) = 2
              AND EXTRACT(DAY FROM c.date_of_birth) = 29
              AND EXTRACT(MONTH FROM p_date) = 2
              AND EXTRACT(DAY FROM p_date) = 28
              AND EXTRACT(DAY FROM (make_date(EXTRACT(YEAR FROM p_date)::integer, 3, 1) - 1)) = 28
          )
      );
$$;

CREATE OR REPLACE FUNCTION public.claim_birthday_message_send(
    p_customer_id uuid,
    p_organization_id uuid,
    p_birthday_year integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    claimed_id uuid;
BEGIN
    INSERT INTO public.birthday_message_sends (
        customer_id,
        organization_id,
        birthday_year
    )
    VALUES (
        p_customer_id,
        p_organization_id,
        p_birthday_year
    )
    ON CONFLICT (customer_id, birthday_year) DO UPDATE
    SET status = 'processing',
        attempt_count = public.birthday_message_sends.attempt_count + 1,
        error_message = NULL,
        last_attempt_at = now(),
        updated_at = now()
    WHERE public.birthday_message_sends.status = 'failed'
       OR (
           public.birthday_message_sends.status = 'processing'
           AND public.birthday_message_sends.last_attempt_at < now() - interval '30 minutes'
       )
    RETURNING id INTO claimed_id;

    RETURN claimed_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_birthday_customers(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_birthday_message_send(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_birthday_customers(uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_birthday_message_send(uuid, uuid, integer) TO service_role;

INSERT INTO public.notification_templates (
    name,
    type,
    channel,
    subject,
    message,
    is_active,
    organization_id
)
SELECT
    'Birthday Greeting',
    'birthday',
    'sms',
    'Happy Birthday',
    $birthday_message$Dear {customer_name},
Wishing you a beautiful birthday and a year ahead filled with grace and joy.

To celebrate you, enjoy 15% OFF on any service at Vasanthi Gulasekharam Salon.
Celebrate yourself with a little extra radiance.

Valid from your birthday for 30 days.
Book your appointment: https://wa.me/94776300577
T&Cs apply.$birthday_message$,
    true,
    o.id
FROM public.organizations o
WHERE NOT EXISTS (
    SELECT 1
    FROM public.notification_templates nt
    WHERE nt.organization_id = o.id
      AND nt.type = 'birthday'
);
