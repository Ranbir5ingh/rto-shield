'use client';

import { useState, type ReactNode } from 'react';
import { bandClass } from '@/lib/format';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function RiskBadge({ band }: { band: string | null }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${bandClass(band)}`}>
      {band || 'Unscored'}
    </span>
  );
}

export function Notice({ tone = 'warn', children }: { tone?: 'warn' | 'info' | 'good'; children: ReactNode }) {
  const tones = {
    warn: 'border-mid/40 text-mid',
    info: 'border-line text-muted',
    good: 'border-low/40 text-low',
  };
  return <div className={`rounded-lg border bg-card px-4 py-3 text-sm leading-6 ${tones[tone]}`}>{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-[0.75rem] font-medium uppercase tracking-[0.12em] text-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-line bg-raised px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-accent';

export function Button({
  children,
  tone = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'ghost' | 'danger' }) {
  const tones = {
    primary: 'btn-primary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  };
  return (
    <button {...props} className={`btn ${tones[tone]} ${props.className || ''}`}>
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <article className={`card spotlight p-5 ${className}`}>{children}</article>;
}

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      className="btn btn-ghost px-2.5 py-1 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}
