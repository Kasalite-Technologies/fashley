import { Link } from '@tanstack/react-router';
export function SiteFooter() {
 return <footer className="mt-auto border-t border-border bg-secondary/40"><div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 md:grid-cols-[1fr_auto]">
 <div><p className="font-display text-2xl">Fashley</p><p className="mt-2 text-sm text-muted-foreground">© 2026 Fashley</p></div>
 <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm"><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms of Service</Link><Link to="/contact">Contact</Link><a className="break-all" href="mailto:hello@fashley.app">hello@fashley.app</a><Link to="/about">About</Link></nav>
 </div></footer>;
}
