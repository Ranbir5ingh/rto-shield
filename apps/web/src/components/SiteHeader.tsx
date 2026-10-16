'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { LogoMark } from '@/components/Logo';

const links = [
  ['#gap', 'The gap'],
  ['#chapters', 'Chapters'],
  ['#model', 'Try it'],
  ['#pricing', 'Pricing'],
  ['#faq', 'FAQ'],
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
      <header className="fixed inset-x-0 top-3 z-[80] flex justify-center px-4 sm:top-5">
        <div
          data-nav-pill
          className="flex items-center gap-1 rounded-full border-2 border-ink bg-paper/95 py-2 pl-3 pr-2 shadow-sticker backdrop-blur-md"
        >
          <Link href="/" className="mr-1 flex items-center gap-2.5" aria-label="RTO Shield home">
            <LogoMark size={30} />
            <span className="font-display text-sm font-black uppercase tracking-[0.08em]">RTO Shield</span>
          </Link>
          <nav className="hidden items-center md:flex" aria-label="Primary">
            {links.map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-inksoft transition hover:bg-hl hover:text-ink"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-1 pl-2 md:flex">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-inksoft transition hover:text-ink"
            >
              Log in
            </Link>
            <Link href="/signup" className="btn-go !rounded-full !px-5 !py-2.5 !text-[11px]">
              Get started <ArrowRight size={14} />
            </Link>
          </div>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink bg-white shadow-sticker-sm md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-paper" role="dialog" aria-label="Menu">
          <div className="flex justify-center px-4 pt-3 sm:pt-5">
            <div className="flex w-auto items-center gap-1 rounded-full border-2 border-ink bg-paper py-2 pl-3 pr-2 shadow-sticker">
              <span className="mr-1 flex items-center gap-2.5">
                <LogoMark size={30} />
                <span className="font-display text-sm font-black uppercase tracking-[0.08em]">RTO Shield</span>
              </span>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink bg-white"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <nav className="flex flex-1 flex-col justify-center gap-2 px-8" aria-label="Mobile">
            {links.map(([href, label], i) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="statement border-b-2 border-dashed border-ink/20 py-5 text-4xl"
              >
                <span className="mr-4 bg-risk px-2 py-1 font-mono text-xs font-bold tracking-[0.2em] text-white">0{i + 1}</span>
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
