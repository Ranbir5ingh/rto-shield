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
      <aside className="relative hidden overflow-hidden border-r border-white/10 bg-panel lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="aurora" aria-hidden="true">
          <span className="aurora-gold drift left-[-10%] top-[10%] h-[24rem] w-[24rem]" />
        </div>
        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-goldlight to-accent-deep font-display text-sm font-extrabold text-void">R</span>
          <span className="font-display text-base font-bold tracking-tight">RTO Shield</span>
        </Link>
        <div className="relative max-w-md">
          <p className="font-mono text-xs tracking-[0.22em] text-gold">BEFORE THE TAPE GUN</p>
          <p className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight">
            Score the order. <em className="accent-serif font-normal text-gold">Confirm</em> the risky ones. Ship the rest.
          </p>
          <div className="card mt-10 divide-y divide-white/6 overflow-hidden">
            {[
              ['S1042', 'HIGH', '78', 'text-signal'],
              ['S1048', 'LOW', '22', 'text-low'],
              ['S1051', 'MED', '51', 'text-warn'],
            ].map(([id, band, score, color]) => (
              <div key={id} className="flex items-center justify-between px-5 py-3.5">
                <span className="font-mono text-xs text-muted">{id}</span>
                <span className={`font-mono text-xs font-bold tracking-widest ${color}`}>{band}</span>
                <span className="font-display text-2xl font-bold tabular-nums">{score}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative font-mono text-xs text-muted">₹499 / MONTH SUGGESTED · NO CARD NEEDED</p>
      </aside>
      <div className="flex flex-col justify-center px-5 py-12 sm:px-12">
        <Link href="/" className="mb-10 flex items-center gap-2.5 lg:hidden">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-goldlight to-accent-deep font-display text-sm font-extrabold text-void">R</span>
          <span className="font-display text-base font-bold tracking-tight">RTO Shield</span>
        </Link>
        <div className="mx-auto w-full max-w-md">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-3 leading-7 text-muted">{lede}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
