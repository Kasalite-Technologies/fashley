import { describe, expect, it } from 'vitest';
import { FREE_GENERATIONS, generationQuote, paymentMatches } from './coin-rules';

describe('FASHLEY coin rules', () => {
  it('allows exactly three free images', () => {
    expect(FREE_GENERATIONS).toBe(3);
    expect(generationQuote(0, 0, 1, 3)).toEqual({ free: 3, coins: 0, affordable: true });
    expect(generationQuote(3, 0, 1, 1)).toEqual({ free: 0, coins: 1, affordable: false });
  });
  it('deducts the per-image cost after the free allowance', () => {
    expect(generationQuote(2, 4, 2, 3)).toEqual({ free: 1, coins: 4, affordable: true });
    expect(generationQuote(3, 5, 2, 3).affordable).toBe(false);
  });
  it('requires verified payment success with exact amount and currency', () => {
    const p = { amount_minor: 1000, currency: 'GHS' };
    expect(paymentMatches(p, { status: 'success', amount: 1000, currency: 'GHS' })).toBe(true);
    expect(paymentMatches(p, { status: 'pending', amount: 1000, currency: 'GHS' })).toBe(false);
    expect(paymentMatches(p, { status: 'success', amount: 999, currency: 'GHS' })).toBe(false);
    expect(paymentMatches(p, { status: 'success', amount: 1000, currency: 'USD' })).toBe(false);
  });
});