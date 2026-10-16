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
    <div className="px-grid grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden overflow-hidden border-r-2 border-lime bg-panel lg:flex lg:flex-col lg:justify-between lg:p-10">
        <Link href="/" className="relative font-display text-xl font-bold text-lime">
          RTO▲SHIELD
        </Link>
        <div className="relative max-w-md">
          <img src="/assets/pixel/arcade-scanner.webp" alt="" className="w-full max-w-xs" />
          <p className="mt-6 font-mono text-xs font-bold uppercase tracking-[0.2em] text-lime">Before the tape gun</p>
          <p className="mt-4 font-display text-3xl font-bold leading-tight">Score the order. Confirm the risky ones. Ship the rest.</p>
          <div className="mt-8 space-y-2">
            {[
              ['S1042', 'HIGH', '78', 'text-danger'],
              ['S1048', 'LOW', '22', 'text-lime'],
              ['S1051', 'MED', '51', 'text-warn'],
            ].map(([id, band, score, color]) => (
              <div key={id} className="flex items-center justify-between border-2 border-line bg-void px-3 py-2.5 text-sm">
                <span className="font-mono text-xs text-muted">{id}</span>
                <span className={`font-mono text-xs font-bold ${color}`}>{band}</span>
                <span className="font-display text-xl tabular-nums">{score}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative font-mono text-xs text-muted">₹499 / MONTH SUGGESTED · NO CARD NEEDED</p>
      </aside>
      <div className="flex flex-col justify-center px-5 py-12 sm:px-12">
        <Link href="/" className="mb-8 font-display text-xl font-bold text-lime lg:hidden">
          RTO▲SHIELD
        </Link>
        <div className="mx-auto w-full max-w-md">
          <h1 className="font-display text-4xl font-bold">{title}</h1>
          <p className="mt-3 leading-6 text-muted">{lede}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
