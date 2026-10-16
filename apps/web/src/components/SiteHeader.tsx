'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const links = [
  ['/#product', 'Product'],
  ['/#method', 'Method'],
  ['/#pricing', 'Pricing'],
  ['/privacy', 'Privacy'],
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-nav">
      <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-2.5 py-2">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-electric text-sm font-black text-white shadow-card">R</span>
          <span className="font-display text-xl">RTO Shield</span>
        </Link>
        <nav className="hidden items-center gap-7 text-[15px] font-semibold md:flex">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="inline-flex items-center py-2 text-ink/70 transition hover:text-electric">
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden text-sm text-muted hover:text-ink sm:inline">
            Log in
          </Link>
          <Link href="/signup" data-magnetic className="btn btn-primary hidden sm:inline-flex">
            Start a shop
          </Link>
          <button
            type="button"
            className="btn btn-ghost px-2 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={16} /> : <Menu size={16} />}
            <span className="sr-only">Menu</span>
          </button>
        </div>
      </div>
      {open ? (
        <nav id="mobile-nav" className="flex flex-col gap-3 border-t border-line px-5 py-4 text-sm md:hidden">
          {links.map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setOpen(false)}>
            Log in
          </Link>
          <Link href="/signup" className="btn btn-primary w-fit" onClick={() => setOpen(false)}>
            Start a shop
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
