import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { useAuth } from '@/lib/use-auth';
import { signupSchema, MIN_PASSWORD_LENGTH } from '@/lib/launch-rules';
import { SiteHeader } from '@/components/SiteHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
export const Route = createFileRoute('/auth')({
 validateSearch: (search:Record<string,unknown>): {mode?:'in'|'up'|'forgot'} => ({mode:search['mode']==='up'?'up':search['mode']==='forgot'?'forgot':'in'}),
 head: ({match}) => {
  const title=match.search.mode==='up'?'Create account | Fashley':match.search.mode==='forgot'?'Forgot password | Fashley':'Sign in | Fashley';
  const description='Sign in to design with your fabric and keep your favourite looks. New to Fashley? Create an account for three free images.';
  return {meta:[{title},{name:'description',content:description},{property:'og:title',content:title},{property:'og:description',content:description},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]};
 }, component:AuthPage,
});
function AuthPage(){
 const {user}=useAuth(); const navigate=useNavigate(); const mode=Route.useSearch().mode ?? 'in';
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [agreed,setAgreed]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
 useEffect(()=>{if(user && mode!=='forgot') navigate({to:'/studio'});},[user,mode,navigate]);
 function switchMode(next:'in'|'up'|'forgot'){setError('');setMessage('');navigate({to:'/auth',search:{mode:next}});}
 async function submit(e:React.FormEvent){e.preventDefault();setError('');setMessage('');if(mode==='up'&&!signupSchema.safeParse({email,password,agreed}).success){setError('Enter a valid email. Use at least 8 characters for your password and agree to the Terms and Privacy Policy.');return;}setBusy(true);try{
  if(mode==='forgot'){const {error:err}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/reset-password`});if(err)throw err;setMessage('If an account exists for this email, you’ll receive a password-reset link.');}
  else if(mode==='up'){const {error:err}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}});if(err)throw err;setMessage('Open the confirmation link in your email before signing in.');}
  else {const {error:err}=await supabase.auth.signInWithPassword({email,password});if(err)throw err;}
 }catch(e){setError(mode==='in'?'We couldn’t sign you in. Check your email and password and try again.':e instanceof Error?e.message:'We couldn’t complete that. Please try again.');}finally{setBusy(false);}}
 async function google(){if(mode==='up'&&!agreed){setError('Please agree to the Terms and Privacy Policy first.');return;}setBusy(true);setError('');try{const result=await lovable.auth.signInWithOAuth('google',{redirect_uri:window.location.origin});if(result.error)throw result.error;}catch{setError('Google sign-in couldn’t start. Please try again.');}finally{setBusy(false);}}
 return <div><SiteHeader/><main className="mx-auto max-w-md px-5 py-12"><h1 className="text-4xl">{mode==='in'?'Welcome back':mode==='up'?'Create your account':'Forgot password?'}</h1><p className="mt-2 text-sm text-muted-foreground">{mode==='forgot'?'We’ll email you a link to choose a new password.':'Keep your favourite designs ready to show your tailor.'}</p>
 {mode==='up'&&<div className="mt-6 flex items-start gap-3"><Checkbox id="agree" checked={agreed} onCheckedChange={v=>setAgreed(v===true)} aria-required="true"/><Label htmlFor="agree" className="leading-relaxed">I agree to the <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.</Label></div>}
 {mode!=='forgot'&&<><Button variant="outline" className="mt-6 w-full" disabled={busy||(mode==='up'&&!agreed)} onClick={google}>Continue with Google</Button><div className="my-6 text-center text-xs uppercase tracking-widest text-muted-foreground">or</div></>}
 <form onSubmit={submit} className="mt-6 space-y-4"><div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></div>
 {mode!=='forgot'&&<div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete={mode==='up'?'new-password':'current-password'} required minLength={MIN_PASSWORD_LENGTH} aria-describedby="password-hint" value={password} onChange={e=>setPassword(e.target.value)}/><p id="password-hint" className="text-xs text-muted-foreground">Use at least 8 characters.</p></div>}
 {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{message&&<p role="status" className="text-sm">{message}</p>}
 <Button type="submit" className="w-full" disabled={busy||(mode==='up'&&!agreed)}>{busy?<><Loader2 className="h-4 w-4 animate-spin"/>Please wait…</>:mode==='in'?'Sign in':mode==='up'?'Create account':'Send reset link'}</Button></form>
 {mode==='in'&&<Button variant="link" className="mt-3 px-0" onClick={()=>switchMode('forgot')}>Forgot password?</Button>}
 <Button variant="link" className="mt-3 h-auto whitespace-normal px-0" onClick={()=>switchMode(mode==='in'?'up':'in')}>{mode==='in'?'New here? Create an account':'Back to sign in'}</Button></main></div>;
}
