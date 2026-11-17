DROP POLICY IF EXISTS "read positions" ON public.positions;
CREATE POLICY "team reads positions" ON public.positions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'office') OR public.has_role(auth.uid(), 'staff'));