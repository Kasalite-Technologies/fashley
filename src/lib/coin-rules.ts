export const FREE_GENERATIONS = 3;
export function generationQuote(freeUsed: number, balance: number, cost: number, count: number) {
  const free = Math.min(count, Math.max(0, FREE_GENERATIONS - freeUsed));
  const coins = (count - free) * cost;
  return { free, coins, affordable: balance >= coins };
}
export function paymentMatches(purchase: { amount_minor: number; currency: string }, payment: { status: string; amount: number; currency: string }) {
  return payment.status === 'success' && purchase.amount_minor === payment.amount && purchase.currency === payment.currency;
}