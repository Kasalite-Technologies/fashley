CREATE OR REPLACE FUNCTION public.reserve_coin_generation(p_user uuid, p_request uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.coin_wallets; g public.coin_generations; c integer; f boolean;
BEGIN
 INSERT INTO public.coin_wallets(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
 SELECT * INTO w FROM public.coin_wallets WHERE user_id=p_user FOR UPDATE;
 SELECT * INTO g FROM public.coin_generations WHERE id=p_request;
 IF FOUND THEN
  IF g.user_id<>p_user OR g.status<>'refunded' OR g.attempts>=2 THEN RAISE EXCEPTION 'This generation request has already been processed'; END IF;
 END IF;
 SELECT generation_cost INTO c FROM public.coin_settings WHERE id=1;
 c:=coalesce(c,1); f:=w.free_used<3;
 IF NOT f AND w.balance<c THEN RAISE EXCEPTION 'Not enough FASHLEY Coins. Buy coins to continue.'; END IF;
 UPDATE public.coin_wallets SET free_used=free_used+CASE WHEN f THEN 1 ELSE 0 END, balance=balance-CASE WHEN f THEN 0 ELSE c END WHERE user_id=p_user;
 INSERT INTO public.coin_generations(id,user_id,cost,is_free) VALUES(p_request,p_user,CASE WHEN f THEN 0 ELSE c END,f)
 ON CONFLICT(id) DO UPDATE SET status='reserved',cost=EXCLUDED.cost,is_free=EXCLUDED.is_free,attempts=coin_generations.attempts+1;
 RETURN CASE WHEN f THEN 0 ELSE c END;
END $$;
COMMENT ON FUNCTION public.reserve_coin_generation(uuid,uuid) IS 'Atomically reserves a free or paid image generation for p_user. The currency is named FASHLEY Coins (site brand spelling); the fashely- purchase reference prefix is technical only and must stay unchanged for in-flight purchases.';