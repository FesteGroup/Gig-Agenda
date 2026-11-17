CREATE TABLE public.expenses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
 day date NOT NULL,
 category text NOT NULL CHECK (category IN ('Taxi','Meal','Parking','Transport','Supplies','Other')),
 amount numeric(10,2) NOT NULL CHECK (amount > 0),
 note text,
 receipt_path text,
 status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','rejected','paid')),
 office_note text,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workers submit own expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'submitted' AND office_note IS NULL AND reviewed_at IS NULL AND (receipt_path IS NULL OR split_part(receipt_path, '/', 1) = auth.uid()::text));
CREATE POLICY "workers read own expenses" ON public.expenses FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "office read expenses" ON public.expenses FOR SELECT TO authenticated USING (public.is_office());
CREATE POLICY "office review expenses" ON public.expenses FOR UPDATE TO authenticated USING (public.is_office()) WITH CHECK (public.is_office());
CREATE POLICY "office delete expenses" ON public.expenses FOR DELETE TO authenticated USING (public.is_office());
CREATE INDEX expenses_user_day_idx ON public.expenses(user_id, day DESC);
CREATE INDEX expenses_event_idx ON public.expenses(event_id);
CREATE POLICY "workers upload own receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "workers read own receipts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "office read receipts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'receipts' AND public.is_office());
GRANT INSERT ON public.notifications TO authenticated;
CREATE POLICY "office insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_office());