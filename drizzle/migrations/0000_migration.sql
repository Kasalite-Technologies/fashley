CREATE TABLE public.designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  image_path text NOT NULL,
  category text NOT NULL,
  occasion text,
  style text,
  collection text NOT NULL DEFAULT 'Favourites',
  accessories jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.designs TO authenticated;
GRANT ALL ON public.designs TO service_role;
ALTER TABLE public.designs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own designs select" ON public.designs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own designs insert" ON public.designs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own designs update" ON public.designs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own designs delete" ON public.designs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "own files select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'designs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'designs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own files delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'designs' AND (storage.foldername(name))[1] = auth.uid()::text);