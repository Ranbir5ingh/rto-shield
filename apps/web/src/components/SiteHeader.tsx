'use client';

import Link from 'next/link';
import { useState } from 'react';

const links = [
  ['/#method', 'Method'],
  ['/#privacy-note', 'Privacy'],
  ['/privacy', 'Policy'],
  ['/login', 'Log in'],
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" className="text-lg font-medium tracking-tight">
          RTO Shield
        </Link>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="hover:opacity-60">
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/signup" className="pill pill-dark">
            Start a shop
          </Link>
          <button
            type="button"
            className="pill pill-light md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            Menu
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
        </nav>
      ) : null}
    </header>
  );
}
