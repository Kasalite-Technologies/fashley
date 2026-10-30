-- Run against the connected database after applying the owner's package prices.
-- Each row must return passed = true. Revisit expectations when prices change.
select '10 coins cost GH₵20' as rule,
  exists(select 1 from public.coin_packages where id = 'starter' and coins = 10 and price_minor = 2000 and currency = 'GHS') as passed
union all
select '30 coins cost GH₵25',
  exists(select 1 from public.coin_packages where id = 'creator' and coins = 30 and price_minor = 2500 and currency = 'GHS')
union all
select '75 coins cost GH₵30',
  exists(select 1 from public.coin_packages where id = 'pro' and coins = 75 and price_minor = 3000 and currency = 'GHS');