import Link from 'next/link';
import type { ReactNode } from 'react';

export function AuthFrame({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden overflow-hidden border-r border-line bg-card lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
        <Link href="/" className="relative flex items-center gap-2 text-sm font-medium">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-[11px] font-semibold text-canvas">R</span>
          RTO Shield
        </Link>
        <div className="relative max-w-md">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Before the tape gun</p>
          <p className="mt-4 font-medium text-display-2">Score the order. Confirm the risky ones. Ship the rest.</p>
          <div className="mt-8 space-y-2">
            {[
              ['S1042', 'High', '78'],
              ['S1048', 'Low', '22'],
              ['S1051', 'Medium', '51'],
            ].map(([id, band, score]) => (
              <div key={id} className="flex items-center justify-between rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm">
                <span className="font-mono text-xs text-muted">{id}</span>
                <span className={band === 'High' ? 'text-high' : band === 'Medium' ? 'text-mid' : 'text-low'}>{band}</span>
                <span className="font-mono tabular-nums">{score}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-muted">₹499 / month suggested. This build does not take a card.</p>
      </aside>
      <div className="flex flex-col justify-center px-5 py-12 sm:px-12">
        <Link href="/" className="mb-8 flex items-center gap-2 text-sm font-medium lg:hidden">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-[11px] font-semibold text-canvas">R</span>
          RTO Shield
        </Link>
        <div className="mx-auto w-full max-w-md">
          <h1 className="font-medium text-display-2">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{lede}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
