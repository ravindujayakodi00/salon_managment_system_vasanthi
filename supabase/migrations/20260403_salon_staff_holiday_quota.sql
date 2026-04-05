-- Per-organization cap on full-day holidays staff can self-schedule per calendar year.
-- NULL = no limit (legacy behavior).

ALTER TABLE public.salon_settings
ADD COLUMN IF NOT EXISTS max_full_day_holidays_per_year INTEGER
  CHECK (max_full_day_holidays_per_year IS NULL OR max_full_day_holidays_per_year >= 0);

COMMENT ON COLUMN public.salon_settings.max_full_day_holidays_per_year IS
  'Max full-day holiday entries per staff member per calendar year; NULL means unlimited';
