import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

export const getCoins = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [wallet, settings, packages, role] = await Promise.all([
    context.supabase.from('coin_wallets').select('balance,free_used').eq('user_id', context.userId).maybeSingle(),
    context.supabase.from('coin_settings').select('*').eq('id', 1).single(),
    context.supabase.from('coin_packages').select('*').order('coins'),
    context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' }),
  ]);
  for (const result of [wallet, settings, packages, role]) if (result.error) throw new Error(result.error.message);
  return { wallet: wallet.data ?? { balance: 0, free_used: 0 }, settings: settings.data, packages: packages.data ?? [], isAdmin: role.data === true, paymentConfigured: Boolean(process.env['PAYSTACK_SECRET_KEY']) };
});

export const saveCoinPackage = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().min(1).max(40), name: z.string().min(1).max(80), coins: z.number().int().min(1).max(100000), price_minor: z.number().int().min(1).max(100000000).nullable(), currency: z.enum(['GHS','NGN','ZAR','KES','USD']), active: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (role.error || !role.data) throw new Error('Only an administrator can change coin packages.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const result = await supabaseAdmin.from('coin_packages').upsert(data);
    if (result.error) throw new Error(result.error.message);
    return { success: true };
  });

export const saveCoinSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ generation_cost: z.number().int().min(1).max(1000), purchases_enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (role.error || !role.data) throw new Error('Only an administrator can change coin settings.');
    if (data.purchases_enabled && !process.env['PAYSTACK_SECRET_KEY']) throw new Error('Connect Paystack before enabling purchases.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const result = await supabaseAdmin.from('coin_settings').update(data).eq('id', 1);
    if (result.error) throw new Error(result.error.message);
    return { success: true };
  });

export const buyCoinPackage = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ packageId: z.string().min(1).max(40) }).parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env['PAYSTACK_SECRET_KEY'];
    if (!key) throw new Error('Coin purchases aren’t available yet.');
    const [settings, pkg, user] = await Promise.all([
      context.supabase.from('coin_settings').select('*').eq('id', 1).single(),
      context.supabase.from('coin_packages').select('*').eq('id', data.packageId).single(),
      context.supabase.auth.getUser(),
    ]);
    if (settings.error || !settings.data?.purchases_enabled || pkg.error || !pkg.data?.active || !pkg.data.price_minor) throw new Error('This coin package isn’t available yet.');
    if (!user.data.user?.email) throw new Error('Add an email address to your account before checkout.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const reference = `fashely-${crypto.randomUUID()}`;
    const p = pkg.data;
    const price = p.price_minor;
    if (!price) throw new Error('The package price has not been set.');
    const inserted = await supabaseAdmin.from('coin_purchases').insert({ reference, user_id: context.userId, package_id: p.id, coins: p.coins, amount_minor: price, currency: p.currency });
    if (inserted.error) throw new Error(inserted.error.message);
    const { paystackRequest } = await import('./paystack.server');
    const checkout = await paystackRequest(key, '/transaction/initialize', { reference, email: user.data.user.email, amount: price, currency: p.currency, callback_url: 'https://fashley.lovable.app/coins' });
    const url = z.string().url().parse(checkout['authorization_url']);
    if (new URL(url).hostname !== 'checkout.paystack.com') throw new Error('We couldn’t open a safe Paystack checkout. Please try again.');
    return { url };
  });

export const confirmCoinPayment = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ reference: z.string().regex(/^fashely-[a-f0-9-]{36}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const p = await context.supabase.from('coin_purchases').select('reference').eq('reference', data.reference).eq('user_id', context.userId).single();
    if (p.error || !p.data) throw new Error('We couldn’t find this purchase in your account.');
    const key = process.env['PAYSTACK_SECRET_KEY'];
    if (!key) throw new Error('Paystack is not connected.');
    const { verifyCoinPayment } = await import('./paystack.server');
    return verifyCoinPayment(key, data.reference);
  });