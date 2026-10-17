import Link from 'next/link';
import type { ReactNode } from 'react';
import { OrderRain } from '@/components/OrderRain';
import { LogoMark } from '@/components/Logo';
import { Eyebrow, Flag, LabelChip } from '@/components/ui';

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
    <div className="relative grid min-h-screen bg-paper lg:grid-cols-[1.05fr_0.95fr]">
      <OrderRain columns={6} />
      <aside className="relative hidden border-r border-ink/20 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Link href="/" className="relative flex items-center gap-3">
          <LogoMark size={30} />
          <span className="font-display text-sm font-extrabold uppercase tracking-[0.08em]">RTO Shield</span>
        </Link>
        <div className="relative max-w-md">
          <Eyebrow>/Before the tape gun/</Eyebrow>
          <p className="statement mt-6 text-[clamp(1.8rem,3vw,2.6rem)]">
            Score the order.<br />Confirm the <span className="text-risk">risky</span> ones.<br />Ship the rest.
          </p>
          <div className="mt-10 border-t border-ink/20">
            {[
              ['S1042 · ₹2,458 · COD', 'CLEAR', 'go'],
              ['S1047 · ₹1,299 · COD', 'RTO RISK', 'red'],
              ['S1051 · ₹1,899 · PREPAID', 'MEDIUM', 'banana'],
            ].map(([id, flag, tone]) => (
              <div key={id} className="datarow">
                <span className="text-ink/70">{id}</span>
                <Flag tone={tone as 'red' | 'banana' | 'go'}>{flag}</Flag>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex gap-3">
          <LabelChip>₹499 / month suggested</LabelChip>
          <LabelChip>No card needed</LabelChip>
        </div>
      </aside>
      <div className="relative flex flex-col justify-center px-5 py-12 sm:px-12">
        <Link href="/" className="mb-10 flex items-center gap-3 lg:hidden">
          <LogoMark size={30} />
          <span className="font-display text-sm font-extrabold uppercase tracking-[0.08em]">RTO Shield</span>
        </Link>
        <div className="mx-auto w-full max-w-md">
          <Eyebrow>/Enter/</Eyebrow>
          <h1 className="statement mt-4 text-[clamp(2.1rem,8vw,3rem)]">{title}</h1>
          <p className="mt-4 leading-7 text-inksoft">{lede}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
