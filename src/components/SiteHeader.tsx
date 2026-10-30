import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/use-auth';
import { Button } from '@/components/ui/button';
import { CartDrawer } from '@/components/CartDrawer';
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import logoAsset from '@/assets/logo.png.asset.json';
const links=[['Home','/'],['Discover','/discover'],['Studio','/studio'],['Wardrobe','/wardrobe'],['Shop','/shop']] as const;
export function SiteHeader(){
 const {user}=useAuth();const navigate=useNavigate();const [open,setOpen]=useState(false);
 async function signOut(){await supabase.auth.signOut();setOpen(false);navigate({to:'/'});}
 return <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur"><div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 md:flex md:justify-between">
 <Link to="/" className="flex w-fit shrink-0 flex-col items-center leading-none"><img src={logoAsset.url} alt="Fashley logo" width={48} height={48} className="h-12 w-12 object-contain"/><span className="mt-1.5 font-display text-lg">Fashley</span></Link>
 <nav aria-label="Main navigation" className="hidden min-w-0 items-center gap-1 text-sm md:flex">{links.map(([label,to])=><Button key={to} asChild size="sm" variant="ghost"><Link to={to} activeProps={{className:'underline underline-offset-4'}}>{label}</Link></Button>)}{user&&<Button asChild size="sm" variant="ghost"><Link to="/coins">Coins</Link></Button>}<CartDrawer/>{user?<Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>:<Button asChild variant="outline" size="sm"><Link to="/auth">Sign in</Link></Button>}</nav>
 <div className="flex shrink-0 items-center gap-3 md:hidden"><CartDrawer/><Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button size="icon" variant="outline" aria-label="Open menu"><Menu className="h-5 w-5"/></Button></SheetTrigger><SheetContent className="w-full max-w-sm"><SheetTitle>Fashley</SheetTitle><SheetDescription>Fashley menu</SheetDescription><nav aria-label="Mobile navigation" className="mt-8 flex flex-col gap-3">{links.map(([label,to])=><SheetClose asChild key={to}><Button asChild variant="ghost" className="justify-start"><Link to={to}>{label}</Link></Button></SheetClose>)}{user&&<SheetClose asChild><Button asChild variant="ghost" className="justify-start"><Link to="/coins">Coins</Link></Button></SheetClose>}{user?<Button variant="outline" onClick={signOut}>Sign out</Button>:<SheetClose asChild><Button asChild><Link to="/auth">Sign in</Link></Button></SheetClose>}</nav></SheetContent></Sheet></div>
 </div></header>;
}
