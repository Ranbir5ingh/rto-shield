import type { ReactNode } from 'react';
import { bandClass } from '@/lib/format';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function RiskBadge({ band }: { band: string | null }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${bandClass(band)}`}>
      {band || 'Unscored'}
    </span>
  );
}

export function Notice({ tone = 'warn', children }: { tone?: 'warn' | 'info' | 'good'; children: ReactNode }) {
  const tones = {
    warn: 'bg-white text-ink',
    info: 'bg-white text-ink',
    good: 'bg-white text-ink',
  };
  return <div className={`rounded-2xl px-4 py-3 text-sm leading-6 ${tones[tone]}`}>{children}</div>;
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
  'w-full rounded-2xl border border-line bg-white px-3 py-3 text-sm outline-none focus:border-ink';

export function Button({
  children,
  tone = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'ghost' | 'danger' }) {
  const tones = {
    primary: 'bg-ink text-white hover:bg-[#2a2a2a]',
    ghost: 'bg-white text-ink hover:bg-ink hover:text-white',
    danger: 'bg-high text-white hover:bg-[#7a1616]',
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
