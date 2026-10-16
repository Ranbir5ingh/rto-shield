'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const links = [
  ['#problem', 'The bleed'],
  ['#how', 'How it works'],
  ['#demo', 'Try it'],
  ['#pricing', 'Pricing'],
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open ]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[80] flex justify-center px-4 pt-4">
        <div
          className={`flex w-full max-w-3xl items-center justify-between gap-4 rounded-full border border-white/10 bg-void/70 py-2.5 pl-6 pr-2.5 backdrop-blur-xl transition-all duration-500 ${
            scrolled ? 'shadow-pop' : ''
          }`}
        >
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-goldlight to-accent-deep font-display text-sm font-extrabold text-void">
              R
            </span>
            <span className="font-display text-base font-bold tracking-tight">RTO Shield</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-ink/70 md:flex">
            {links.map(([href, label]) => (
              <Link key={href} href={href} className="transition hover:text-gold">
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden px-3 py-2 text-sm text-ink/70 transition hover:text-ink sm:block">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-gradient-to-br from-goldlight to-accent-deep px-5 py-2.5 text-sm font-semibold text-void transition hover:brightness-110"
            >
              Get started
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-ink md:hidden"
            >
              <span className="flex flex-col gap-1.5">
                <span className="block h-px w-4 bg-ink" />
                <span className="block h-px w-4 bg-ink" />
              </span>
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-void/95 backdrop-blur-xl">
          <div className="flex justify-end p-6">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="grid h-11 w-11 place-items-center rounded-full border border-white/15 text-xl text-ink"
            >
              ✕
            </button>
          </div>
          <nav className="flex flex-1 flex-col justify-center gap-1 px-8">
            {[...links, ['/login', 'Log in'] as const].map(([href, label], i) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="group flex items-baseline gap-4 border-b border-white/8 py-5"
              >
                <span className="font-mono text-xs text-muted">0{i + 1}</span>
                <span className="font-display text-4xl font-extrabold tracking-tight transition group-hover:translate-x-2 group-hover:text-gold">
                  {label}
                </span>
              </Link>
            ))}
          </nav>
          <div className="p-8">
            <Link href="/signup" onClick={() => setOpen(false)} className="btn btn-primary w-full">
              Get started
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
