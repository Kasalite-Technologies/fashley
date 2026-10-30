import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { notificationSchema } from '@/lib/launch-rules';
import { Button } from './ui/button';
import { Input } from './ui/input';
export function StockNotification({section}: {section:'outfits'|'fabric'}) {
 const [email,setEmail]=useState(''); const [busy,setBusy]=useState(false); const [done,setDone]=useState(false); const [error,setError]=useState('');
 async function submit(e:React.FormEvent) { e.preventDefault(); const parsed=notificationSchema.safeParse({email,section}); if(!parsed.success){setError('Please enter a valid email address.');return;} setBusy(true);setError('');try {const {error:err}=await supabase.from('shop_notifications').insert(parsed.data);if(err && err.code!=='23505') throw err;setDone(true);}catch{setError('We couldn’t save your request. Please try again.');}finally{setBusy(false);}}
 return <div className="mt-6 border-y border-border py-8"><h3 className="text-2xl">Coming soon. Get notified</h3>{done?<p role="status" className="mt-4 flex items-center gap-2"><Check className="h-4 w-4"/>You’re on the list for {section==='fabric'?'fabric':'ready-made outfits'}.</p>:<form onSubmit={submit} className="mt-4 max-w-lg space-y-3"><label className="text-sm" htmlFor={`notify-${section}`}>Email address</label><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><Input id={`notify-${section}`} type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><Button disabled={busy} type="submit">{busy?<><Loader2 className="h-4 w-4 animate-spin"/>Saving…</>:'Get notified'}</Button></div><p className="text-xs text-muted-foreground">Submit your email to receive a message when this section has stock. To stop these emails, write to hello@fashley.app.</p>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}</form>}</div>;
}
