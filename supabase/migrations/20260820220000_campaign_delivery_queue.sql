-- Reliable, idempotent delivery queue for campaign messages.

ALTER TABLE public.campaign_sends
  ADD COLUMN IF NOT EXISTS subject_content TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.campaign_sends
  DROP CONSTRAINT IF EXISTS campaign_sends_status_check;

ALTER TABLE public.campaign_sends
  ADD CONSTRAINT campaign_sends_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'delivered', 'failed'));

ALTER TABLE public.campaign_sends
  DROP CONSTRAINT IF EXISTS campaign_sends_channel_check;

ALTER TABLE public.campaign_sends
  ADD CONSTRAINT campaign_sends_channel_check
  CHECK (channel IN ('sms', 'email', 'both'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_sends_recipient
  ON public.campaign_sends (organization_id, campaign_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_campaign_sends_pending_batch
  ON public.campaign_sends (campaign_id, status, created_at);

CREATE OR REPLACE FUNCTION public.claim_campaign_send_batch(
  p_campaign_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  send_id UUID,
  organization_id UUID,
  customer_id UUID,
  channel TEXT,
  message_content TEXT,
  subject_content TEXT,
  retry_count INTEGER,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT cs.id
    FROM public.campaign_sends cs
    JOIN public.campaigns c ON c.id = cs.campaign_id
    WHERE cs.campaign_id = p_campaign_id
      AND c.status = 'sending'
      AND (
        cs.status = 'pending'
        OR (
          cs.status = 'processing'
          AND cs.last_attempt_at < NOW() - INTERVAL '5 minutes'
        )
      )
    ORDER BY cs.created_at, cs.id
    FOR UPDATE OF cs SKIP LOCKED
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100))
  ), claimed AS (
    UPDATE public.campaign_sends cs
    SET status = 'processing',
        retry_count = COALESCE(cs.retry_count, 0) + 1,
        last_attempt_at = NOW(),
        updated_at = NOW()
    FROM candidates q
    WHERE cs.id = q.id
    RETURNING cs.*
  )
  SELECT
    cs.id AS send_id,
    cs.organization_id,
    cs.customer_id,
    cs.channel,
    cs.message_content,
    cs.subject_content,
    cs.retry_count,
    c.name AS customer_name,
    c.phone AS customer_phone,
    c.email AS customer_email
  FROM claimed cs
  JOIN public.customers c
    ON c.id = cs.customer_id
   AND c.organization_id = cs.organization_id
  ORDER BY cs.created_at, cs.id;
$$;

CREATE OR REPLACE FUNCTION public.refresh_campaign_delivery_counts(
  p_campaign_id UUID
)
RETURNS TABLE (
  campaign_status TEXT,
  target_count INTEGER,
  sent_count INTEGER,
  failed_count INTEGER,
  pending_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_count INTEGER;
  v_sent_count INTEGER;
  v_failed_count INTEGER;
  v_pending_count INTEGER;
  v_status TEXT;
BEGIN
  SELECT
    COUNT(DISTINCT cs.customer_id)::INTEGER,
    COUNT(DISTINCT cs.customer_id) FILTER (
      WHERE cs.status IN ('sent', 'delivered')
    )::INTEGER,
    COUNT(DISTINCT cs.customer_id) FILTER (
      WHERE cs.status = 'failed'
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE cs.status IN ('pending', 'processing')
    )::INTEGER
  INTO v_target_count, v_sent_count, v_failed_count, v_pending_count
  FROM public.campaign_sends cs
  WHERE cs.campaign_id = p_campaign_id;

  v_status := CASE WHEN v_pending_count = 0 THEN 'completed' ELSE 'sending' END;

  UPDATE public.campaigns
  SET target_count = v_target_count,
      sent_count = v_sent_count,
      failed_count = v_failed_count,
      status = v_status,
      completed_at = CASE WHEN v_pending_count = 0 THEN NOW() ELSE NULL END,
      updated_at = NOW()
  WHERE id = p_campaign_id;

  RETURN QUERY
  SELECT v_status, v_target_count, v_sent_count, v_failed_count, v_pending_count;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_campaign_send_batch(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_campaign_delivery_counts(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_campaign_send_batch(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_campaign_delivery_counts(UUID) TO service_role;
