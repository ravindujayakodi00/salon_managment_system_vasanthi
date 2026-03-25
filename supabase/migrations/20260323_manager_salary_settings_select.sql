-- Allow managers to view salary settings (needed for /financial dashboard)

CREATE POLICY "Manager can view salary settings"
  ON public.salary_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('Owner', 'Manager')
    )
  );

