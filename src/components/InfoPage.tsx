import type { ReactNode } from 'react';
import { SiteHeader } from './SiteHeader';
export function InfoPage({title, children}: {title:string;children:ReactNode}) {
 return <div><SiteHeader/><main className="mx-auto max-w-3xl px-5 py-12"><h1 className="text-4xl sm:text-5xl">{title}</h1><div className="mt-8 space-y-7 leading-relaxed [&_h2]:mb-2 [&_h2]:text-2xl [&_a]:underline [&_a]:break-all">{children}</div></main></div>;
}
