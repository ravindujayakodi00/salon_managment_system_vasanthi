-- Staff Salary Advances
-- Records cash advances taken by stylists/managers that should reduce their available salary.

CREATE TABLE IF NOT EXISTS public.staff_salary_advances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES public.staff(id),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_salary_advances_staff_id_created_at
  ON public.staff_salary_advances(staff_id, created_at DESC);

ALTER TABLE public.staff_salary_advances ENABLE ROW LEVEL SECURITY;

-- Owners/Managers can view all advances
CREATE POLICY "salary_advances_select_owner_manager"
  ON public.staff_salary_advances
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('Owner', 'Manager')
    )
  );

-- Stylists can view their own advances
CREATE POLICY "salary_advances_select_stylist_own"
  ON public.staff_salary_advances
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'Stylist'
    )
    AND staff_id = (
      SELECT s.id FROM public.staff s
      WHERE s.profile_id = auth.uid()
        AND s.role = 'Stylist'
        AND s.is_active = true
      LIMIT 1
    )
  );

-- Owners/Managers can insert advances for any stylist
CREATE POLICY "salary_advances_insert_owner_manager"
  ON public.staff_salary_advances
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('Owner', 'Manager')
    )
    AND created_by = auth.uid()
  );

-- Stylists can insert advances only for their own staff record
CREATE POLICY "salary_advances_insert_stylist_own"
  ON public.staff_salary_advances
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'Stylist'
    )
    AND created_by = auth.uid()
    AND staff_id = (
      SELECT s.id FROM public.staff s
      WHERE s.profile_id = auth.uid()
        AND s.role = 'Stylist'
        AND s.is_active = true
      LIMIT 1
    )
  );

