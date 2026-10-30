import { paymentMatches } from './coin-rules';

export async function paystackRequest(key: string, path: string, body?: unknown) {
  const response = await fetch(`https://api.paystack.co${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json() as { status: boolean; message?: string; data?: Record<string, unknown> };
  if (!response.ok || !result.status || !result.data) throw new Error(result.message ?? `Paystack couldn’t complete the request (${response.status})`);
  return result.data;
}

export async function verifyCoinPayment(key: string, reference: string) {
  const payment = await paystackRequest(key, `/transaction/verify/${encodeURIComponent(reference)}`);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: purchase, error } = await supabaseAdmin.from('coin_purchases').select('*').eq('reference', reference).single();
  if (error || !purchase) throw new Error('We couldn’t find this purchase.');
  if (!paymentMatches(purchase, { status: String(payment['status']), amount: Number(payment['amount']), currency: String(payment['currency']) })) throw new Error('This payment is incomplete or does not match your purchase.');
  const credited = await supabaseAdmin.rpc('fulfill_coin_purchase', { p_reference: reference, p_amount: purchase.amount_minor, p_currency: purchase.currency });
  if (credited.error) throw new Error(credited.error.message);
  return { credited: credited.data, coins: purchase.coins };
}