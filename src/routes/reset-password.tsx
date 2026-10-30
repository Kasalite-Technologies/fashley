import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SiteHeader } from '@/components/SiteHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MIN_PASSWORD_LENGTH } from '@/lib/launch-rules';
export const Route = createFileRoute('/reset-password')({head:()=>({meta:[{title:'Reset password | Fashley'},{name:'description',content:'Choose a new password for your Fashley account.'},{property:'og:title',content:'Reset password | Fashley'},{property:'og:description',content:'Choose a new password for your Fashley account.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:ResetPassword});
function ResetPassword(){
 const [ready,setReady]=useState(false);const [checking,setChecking]=useState(true);const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{
  const hash=new URLSearchParams(window.location.hash.slice(1));const recovery=hash.get('type')==='recovery';
  const {data}=supabase.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY'){setReady(true);setChecking(false);}});
  if(recovery){supabase.auth.getUser().then(({data,error})=>{setReady(!error&&!!data.user);setChecking(false);});}else setChecking(false);
  return ()=>data.subscription.unsubscribe();
 },[]);
 async function submit(e:React.FormEvent){e.preventDefault();if(!ready)return;if(password.length<MIN_PASSWORD_LENGTH){setError('Use at least 8 characters.');return;}if(password!==confirm){setError('The passwords don’t match. Enter the same password in both boxes.');return;}setBusy(true);setError('');try{const {error:err}=await supabase.auth.updateUser({password});if(err)throw err;setDone(true);await supabase.auth.signOut();}catch{setError('We couldn’t update your password. Try again or request a fresh link.');}finally{setBusy(false);}}
 return <div><SiteHeader/><main className="mx-auto max-w-md px-5 py-12"><h1 className="text-4xl">Choose a new password</h1>{checking?<p role="status" className="mt-6">Checking your reset link…</p>:done?<div className="mt-6"><p role="status">Your password has been updated.</p><Button asChild className="mt-4"><Link to="/auth" search={{mode:'in'}}>Sign in</Link></Button></div>:!ready?<div className="mt-6"><p>This reset link is missing or has expired. Request a new link to choose your password.</p><Button asChild className="mt-4"><Link to="/auth" search={{mode:'forgot'}}>Request a reset link</Link></Button></div>:<form onSubmit={submit} className="mt-6 space-y-4"><div><Label htmlFor="new-password">New password</Label><Input id="new-password" autoComplete="new-password" type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/><p className="mt-2 text-xs text-muted-foreground">Use at least 8 characters.</p></div><div><Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)}/></div>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={busy} type="submit">{busy?<><Loader2 className="h-4 w-4 animate-spin"/>Updating…</>:'Update password'}</Button></form>}</main></div>;
}
