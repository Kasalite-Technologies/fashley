CREATE TABLE public.shop_notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, section text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT shop_notification_email CHECK (char_length(email) <= 254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'), CONSTRAINT shop_notification_section CHECK (section IN ('outfits', 'fabric')), UNIQUE(email, section));
GRANT INSERT ON public.shop_notifications TO anon, authenticated;
GRANT ALL ON public.shop_notifications TO service_role;
ALTER TABLE public.shop_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visitors may request stock notifications" ON public.shop_notifications FOR INSERT TO anon, authenticated WITH CHECK (true);