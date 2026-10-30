import { createFileRoute, Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useRef, useState } from 'react';
import { Coins, ShoppingBag, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useCoins } from '@/lib/use-coins';
import { useAuth } from '@/lib/use-auth';
import { buyCoinPackage, confirmCoinPayment, saveCoinPackage, saveCoinSettings } from '@/lib/coins.functions';
import { SiteHeader } from '@/components/SiteHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BackButton } from '@/components/BackButton';

export const Route = createFileRoute('/coins')({
  head: () => ({ meta: [
    { title: 'FASHLEY Coins | Fashley' }, { name: 'description', content: 'Check your FASHLEY Coins balance. Buy coins for more outfit, shoe or bag designs after your free images.' },
    { property: 'og:title', content: 'FASHLEY Coins | Fashley' }, { property: 'og:description', content: 'Check your balance and buy coins for your next design.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: CoinsPage,
});

function CoinsPage() {
  const { user } = useAuth();
  const coins = useCoins();
  const buy = useServerFn(buyCoinPackage);
  const confirm = useServerFn(confirmCoinPayment);
  const savePackage = useServerFn(saveCoinPackage);
  const saveSettings = useServerFn(saveCoinSettings);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [admin, setAdmin] = useState(false);
  const data = coins.data;
  async function action(fn: () => Promise<unknown>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try { await fn(); await coins.refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : 'We couldn’t complete that. Please try again.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <div className="min-h-screen"><SiteHeader /><main className="mx-auto max-w-5xl px-5 py-10">
    <BackButton fallback="/" />
    <h1 className="mt-6 text-4xl">FASHLEY Coins</h1>
    {!user ? <Button asChild className="mt-6"><Link to="/auth">Sign in to view your coins</Link></Button> : coins.isPending ? <p className="mt-6 text-muted-foreground">Loading your balance…</p> : coins.error ? <p role="alert" className="mt-6 text-destructive">{coins.error.message}</p> : data ? <>
      <div className="my-8 flex flex-wrap items-center gap-8 border-y border-border py-6">
        <div><p className="text-sm text-muted-foreground">Current coin balance</p><p className="mt-2 flex items-center gap-3 text-3xl"><Coins className="h-7 w-7 text-primary" />{data.wallet.balance}</p></div>
        <div><p className="text-sm text-muted-foreground">Free generations remaining</p><p className="mt-2 text-3xl">{Math.max(0, 3 - data.wallet.free_used)} / 3</p></div>
        <div><p className="text-sm text-muted-foreground">Cost per image</p><p className="mt-2 text-3xl">{data.settings?.generation_cost ?? 1} coin{data.settings?.generation_cost === 1 ? '' : 's'}</p></div>
        <Button asChild variant="outline"><Link to="/studio">Back to designing</Link></Button>
      </div>
      <Button variant="outline" disabled={busy} onClick={() => action(async () => {
        const reference = new URLSearchParams(window.location.search).get('reference');
        if (!reference) { toast.info('There’s no payment reference to check. Complete a coin purchase first.'); return; }
        const result = await confirm({ data: { reference } });
        toast.success(result.credited ? `${result.coins} coins added to your balance` : 'The coins from this payment are already in your balance.');
      })}><CheckCircle className="h-4 w-4" />Check completed payment</Button>
      <h2 className="mt-10 text-3xl">Buy Coins</h2>
      {(!data.paymentConfigured || !data.settings?.purchases_enabled) && <p className="mt-3 text-muted-foreground">Coin purchases aren’t available yet. Package prices still need confirmation.</p>}
      <div className="mt-6 grid gap-5 md:grid-cols-3">{data.packages.filter(p => p.active).map(p => <article key={p.id} className="rounded-lg border border-border bg-card p-6">
        <Coins className="h-6 w-6 text-primary" /><h3 className="mt-4 text-2xl">{p.name}</h3><p className="mt-2 text-3xl">{p.coins} <span className="text-base text-muted-foreground">coins</span></p>
        <p className="my-5 text-sm text-muted-foreground">{p.price_minor ? new Intl.NumberFormat('en-GH', { style: 'currency', currency: p.currency }).format(p.price_minor / 100) : 'Price not set'}</p>
        <Button className="w-full" disabled={busy || !p.price_minor || !data.paymentConfigured || !data.settings?.purchases_enabled} onClick={() => action(async () => { const result = await buy({ data: { packageId: p.id } }); window.location.assign(result.url); })}><ShoppingBag className="h-4 w-4" />Buy Coins</Button>
      </article>)}</div>
      {data.isAdmin && <section className="mt-12 border-t border-border pt-8">
        <Button variant="outline" onClick={() => setAdmin(!admin)}>Coin administration</Button>
        {admin && <div className="mt-6 space-y-6">
          <h2 className="text-3xl">Package prices</h2>
          {data.packages.map(p => <form key={`${p.id}-${p.price_minor}-${p.coins}`} className="grid items-end gap-3 border-b border-border pb-5 sm:grid-cols-5" onSubmit={e => {
            e.preventDefault(); const f = new FormData(e.currentTarget);
            const price = String(f.get('price') ?? '').trim();
            void action(async () => { await savePackage({ data: { id: p.id, name: String(f.get('name')), coins: Number(f.get('coins')), price_minor: price ? Math.round(Number(price) * 100) : null, currency: String(f.get('currency')) as 'GHS' | 'NGN' | 'ZAR' | 'KES' | 'USD', active: f.get('active') === 'on' } }); toast.success('Package saved'); });
          }}>
            <label className="text-sm">Name<Input name="name" defaultValue={p.name} required maxLength={80} /></label>
            <label className="text-sm">Coins<Input name="coins" type="number" min={1} max={100000} defaultValue={p.coins} required /></label>
            <label className="text-sm">Price<Input name="price" type="number" min="0.01" step="0.01" defaultValue={p.price_minor ? p.price_minor / 100 : ''} /></label>
            <label className="text-sm">Currency<select name="currency" defaultValue={p.currency} className="h-9 w-full rounded-md border border-input bg-background px-2">{['GHS','NGN','ZAR','KES','USD'].map(c => <option key={c}>{c}</option>)}</select></label>
            <div><label className="mb-2 flex gap-2 text-sm"><input name="active" type="checkbox" defaultChecked={p.active} />Active</label><Button type="submit" disabled={busy}>Save package</Button></div>
          </form>)}
          <form key={String(data.settings?.purchases_enabled) + data.settings?.generation_cost} className="flex flex-wrap items-end gap-5" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void action(async () => { await saveSettings({ data: { generation_cost: Number(f.get('cost')), purchases_enabled: f.get('enabled') === 'on' } }); toast.success('Coin settings saved'); }); }}>
            <label className="text-sm">Coins per image<Input name="cost" type="number" min={1} max={1000} defaultValue={data.settings?.generation_cost ?? 1} required /></label>
            <label className="flex gap-2 text-sm"><input name="enabled" type="checkbox" defaultChecked={data.settings?.purchases_enabled} />Enable purchases</label>
            <Button disabled={busy}>Save settings</Button>
          </form>
        </div>}
      </section>}
    </> : null}
  </main></div>;
}