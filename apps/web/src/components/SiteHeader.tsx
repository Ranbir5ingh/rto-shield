'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';

const links = [
  ['#gap', 'The gap'],
  ['#chapters', 'Chapters'],
  ['#model', 'Try it'],
  ['#pricing', 'Pricing'],
  ['#faq', 'FAQ'],
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
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
      <header
        className={`fixed inset-x-0 top-0 z-[80] transition-colors ${
          scrolled ? 'border-b border-line bg-black/85 backdrop-blur-md' : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-page items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="RTO Shield home">
            <span className="grid h-8 w-8 place-items-center bg-go font-display text-sm font-black text-black">R</span>
            <span className="font-display text-sm font-extrabold uppercase tracking-[0.08em]">RTO Shield</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            {links.map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-muted transition hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/login"
              className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-muted transition hover:text-white"
            >
              Log in
            </Link>
            <Link href="/signup" className="btn-go !px-5 !py-3 !text-[11px]">
              Get started <ArrowRight size={14} />
            </Link>
          </div>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center text-white md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black" role="dialog" aria-label="Menu">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center bg-go font-display text-sm font-black text-black">R</span>
              <span className="font-display text-sm font-extrabold uppercase tracking-[0.08em]">RTO Shield</span>
            </span>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center text-white"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X size={22} />
            </button>
          </div>
          <nav className="flex flex-1 flex-col justify-center gap-2 px-8" aria-label="Mobile">
            {links.map(([href, label], i) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="statement border-b border-line py-5 text-4xl text-white"
              >
                <span className="mr-4 font-mono text-xs font-medium tracking-[0.2em] text-signal">0{i + 1}</span>
                {label}
              </a>
            ))}
            <div className="mt-10 flex flex-col gap-4">
              <Link href="/signup" onClick={() => setOpen(false)} className="btn-go justify-center">
                Get started <ArrowRight size={14} />
              </Link>
              <Link href="/login" onClick={() => setOpen(false)} className="btn-ghost justify-center">
                Log in
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
