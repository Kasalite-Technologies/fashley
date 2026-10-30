import { createFileRoute } from '@tanstack/react-router';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const Route = createFileRoute('/api/public/paystack')({ server: { handlers: {
  POST: async ({ request }) => {
    const key = process.env['PAYSTACK_SECRET_KEY'];
    if (!key) return new Response('Payments unavailable', { status: 503 });
    const raw = await request.text();
    const signature = request.headers.get('x-paystack-signature');
    const expected = createHmac('sha512', key).update(raw).digest('hex');
    if (!signature || !/^[a-f0-9]{128}$/i.test(signature) || !timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) return new Response('Invalid signature', { status: 401 });
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return new Response('Invalid event', { status: 400 }); }
    const event = z.object({ event: z.string(), data: z.object({ reference: z.string().max(100) }).passthrough() }).safeParse(parsed);
    if (!event.success) return new Response('Invalid event', { status: 400 });
    if (event.data.event !== 'charge.success' || !/^fashely-[a-f0-9-]{36}$/.test(event.data.data.reference)) return new Response('ok');
    try {
      const { verifyCoinPayment } = await import('@/lib/paystack.server');
      await verifyCoinPayment(key, event.data.data.reference);
      return new Response('ok');
    } catch { return new Response('Payment could not be verified', { status: 500 }); }
  },
} } });