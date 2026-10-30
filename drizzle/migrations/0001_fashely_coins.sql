CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, role public.app_role NOT NULL, UNIQUE(user_id,role));
GRANT SELECT ON public.user_roles TO authenticated; GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
REVOKE ALL ON FUNCTION public.has_role(uuid,public.app_role) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated,service_role;
CREATE POLICY own_roles ON public.user_roles FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.coin_settings (id integer PRIMARY KEY DEFAULT 1 CHECK(id=1), generation_cost integer NOT NULL DEFAULT 1 CHECK(generation_cost>0), purchases_enabled boolean NOT NULL DEFAULT false);
GRANT SELECT ON public.coin_settings TO authenticated; GRANT ALL ON public.coin_settings TO service_role;
ALTER TABLE public.coin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_settings ON public.coin_settings FOR SELECT TO authenticated USING(true);
CREATE TABLE public.coin_packages (id text PRIMARY KEY, name text NOT NULL, coins integer NOT NULL CHECK(coins>0), price_minor integer CHECK(price_minor>0), currency text NOT NULL DEFAULT 'GHS' CHECK(currency IN ('GHS','NGN','ZAR','KES','USD')), active boolean NOT NULL DEFAULT true);
GRANT SELECT ON public.coin_packages TO authenticated; GRANT ALL ON public.coin_packages TO service_role;
ALTER TABLE public.coin_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_packages ON public.coin_packages FOR SELECT TO authenticated USING(true);
CREATE TABLE public.coin_wallets (user_id uuid PRIMARY KEY, balance integer NOT NULL DEFAULT 0 CHECK(balance>=0), free_used integer NOT NULL DEFAULT 0 CHECK(free_used BETWEEN 0 AND 3));
GRANT SELECT ON public.coin_wallets TO authenticated; GRANT ALL ON public.coin_wallets TO service_role;
ALTER TABLE public.coin_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_wallet ON public.coin_wallets FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.coin_generations (id uuid PRIMARY KEY, user_id uuid NOT NULL, cost integer NOT NULL, is_free boolean NOT NULL, status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','completed','refunded')), attempts integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.coin_generations TO authenticated; GRANT ALL ON public.coin_generations TO service_role;
ALTER TABLE public.coin_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_generations ON public.coin_generations FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.coin_purchases (reference text PRIMARY KEY, user_id uuid NOT NULL, package_id text NOT NULL, coins integer NOT NULL CHECK(coins>0), amount_minor integer NOT NULL CHECK(amount_minor>0), currency text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid')), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.coin_purchases TO authenticated; GRANT ALL ON public.coin_purchases TO service_role;
ALTER TABLE public.coin_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_purchases ON public.coin_purchases FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE FUNCTION public.reserve_coin_generation(p_user uuid,p_request uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
 IF NOT f AND w.balance<c THEN RAISE EXCEPTION 'Not enough FASHELY Coins. Buy coins to continue.'; END IF;
 UPDATE public.coin_wallets SET free_used=free_used+CASE WHEN f THEN 1 ELSE 0 END, balance=balance-CASE WHEN f THEN 0 ELSE c END WHERE user_id=p_user;
 INSERT INTO public.coin_generations(id,user_id,cost,is_free) VALUES(p_request,p_user,CASE WHEN f THEN 0 ELSE c END,f)
 ON CONFLICT(id) DO UPDATE SET status='reserved',cost=EXCLUDED.cost,is_free=EXCLUDED.is_free,attempts=coin_generations.attempts+1;
 RETURN CASE WHEN f THEN 0 ELSE c END;
END $$;
CREATE FUNCTION public.finish_coin_generation(p_request uuid,p_success boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g public.coin_generations;
BEGIN
 SELECT * INTO g FROM public.coin_generations WHERE id=p_request FOR UPDATE;
 IF NOT FOUND OR g.status<>'reserved' THEN RETURN; END IF;
 IF NOT p_success THEN UPDATE public.coin_wallets SET balance=balance+g.cost,free_used=free_used-CASE WHEN g.is_free THEN 1 ELSE 0 END WHERE user_id=g.user_id; END IF;
 UPDATE public.coin_generations SET status=CASE WHEN p_success THEN 'completed' ELSE 'refunded' END WHERE id=p_request;
END $$;
CREATE FUNCTION public.fulfill_coin_purchase(p_reference text,p_amount integer,p_currency text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.coin_purchases;
BEGIN
 SELECT * INTO p FROM public.coin_purchases WHERE reference=p_reference FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown purchase'; END IF;
 IF p.amount_minor<>p_amount OR p.currency<>p_currency THEN RAISE EXCEPTION 'Payment amount or currency does not match'; END IF;
 IF p.status='paid' THEN RETURN false; END IF;
 INSERT INTO public.coin_wallets(user_id,balance) VALUES(p.user_id,p.coins) ON CONFLICT(user_id) DO UPDATE SET balance=coin_wallets.balance+EXCLUDED.balance;
 UPDATE public.coin_purchases SET status='paid' WHERE reference=p_reference;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.reserve_coin_generation(uuid,uuid), public.finish_coin_generation(uuid,boolean),public.fulfill_coin_purchase(text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_coin_generation(uuid,uuid),public.finish_coin_generation(uuid,boolean),public.fulfill_coin_purchase(text,integer,text) TO service_role;