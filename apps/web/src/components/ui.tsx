import type { ReactNode } from 'react';
import { bandClass } from '@/lib/format';

export function RiskBadge({ band }: { band: string | null }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${bandClass(band)}`}>
      {band || 'Unscored'}
    </span>
  );
}

export function Notice({ tone = 'warn', children }: { tone?: 'warn' | 'info' | 'good'; children: ReactNode }) {
  const tones = {
    warn: 'border-warn/30 bg-warn/10 text-warn',
    info: 'border-navy/15 bg-white text-navy',
    good: 'border-forest/20 bg-forest/10 text-forest',
  };
  return <div className={`rounded-xl border px-4 py-3 text-sm leading-6 ${tones[tone]}`}>{children}</div>;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-ink/80">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none ring-saffron/30 focus:ring-2';

export function Button({
  children,
  tone = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'ghost' | 'danger' }) {
  const tones = {
    primary: 'bg-saffron text-white hover:bg-[#a84614]',
    ghost: 'border border-line bg-white text-ink hover:bg-paper',
    danger: 'bg-danger text-white hover:bg-[#821f1f]',
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${tones[tone]} ${props.className || ''}`}
    >
      {children}
    </button>
  );
}
