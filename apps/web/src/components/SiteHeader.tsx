'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const links = [
  ['/#level-1', 'Level 01 · The Boss'],
  ['/#level-2', 'Level 02 · The Scanner'],
  ['/#level-3', 'Level 03 · How It Plays'],
  ['/#final', 'Final Boss · Pricing'],
  ['/login', 'Log in'],
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open ]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[80]">
        <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="px-cut-sm flex items-center gap-2 border-2 border-lime bg-void/90 px-3 py-2 backdrop-blur-sm">
            <span className="font-display text-lg font-bold leading-none text-lime">RTO▲SHIELD</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/signup" className="btn btn-primary hidden !px-5 !py-2.5 !text-sm sm:inline-flex">
              ▶ Press start
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="px-cut-sm grid h-11 w-11 place-items-center border-2 border-lime bg-void/90 backdrop-blur-sm transition hover:bg-lime"
            >
              <span className="flex flex-col gap-1.5">
                <span className="block h-0.5 w-5 bg-lime transition group-hover:bg-void" />
                <span className="block h-0.5 w-5 bg-lime" />
                <span className="block h-0.5 w-5 bg-lime" />
              </span>
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="px-grid fixed inset-0 z-[100] flex flex-col bg-void/97 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-page items-center justify-between px-4 py-4 sm:px-6">
            <span className="font-display text-lg font-bold text-lime">RTO▲SHIELD</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="px-cut-sm grid h-11 w-11 place-items-center border-2 border-pink bg-void text-2xl text-pink transition hover:bg-pink hover:text-void"
            >
              ✕
            </button>
          </div>
          <nav className="mx-auto flex w-full max-w-page flex-1 flex-col justify-center gap-2 px-4 sm:px-6">
            {links.map(([href, label], i) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="group flex items-baseline gap-4 border-b-2 border-line py-4 transition hover:border-lime"
              >
                <span className="font-mono text-sm text-muted">0{i + 1}</span>
                <span className="font-display text-3xl font-bold text-ink transition group-hover:translate-x-2 group-hover:text-lime sm:text-5xl">
                  {label}
                </span>
              </Link>
            ))}
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="btn btn-primary mt-8 self-start !text-lg"
            >
              ▶ Create a login
            </Link>
          </nav>
          <p className="mx-auto w-full max-w-page px-4 pb-8 font-mono text-xs text-muted sm:px-6">
            MIT licensed · your phone number never leaves the shop
          </p>
        </div>
      )}
    </>
  );
}
