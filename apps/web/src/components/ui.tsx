'use client';

import { useState, type ReactNode } from 'react';
import { bandClass } from '@/lib/format';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function RiskBadge({ band }: { band: string | null }) {
  return (
    <span className={`risk-pill ${bandClass(band)}`}>
      {band || 'Unscored'}
    </span>
  );
}

export function Notice({ tone = 'warn', children }: { tone?: 'warn' | 'info' | 'good'; children: ReactNode }) {
  const tones = {
    warn: 'border-warn/50 text-warn',
    info: 'border-cyan/50 text-cyan',
    good: 'border-low/50 text-low',
  };
  return <div className={`rounded-2xl border bg-panel px-5 py-4 font-mono text-sm leading-6 ${tones[tone]}`}>{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block font-mono text-[0.72rem] font-medium uppercase tracking-[0.16em] text-gold">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-line bg-void px-4 py-3 font-mono text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-gold';

export function Button({
  children,
  tone = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'electric' | 'ghost' | 'danger' }) {
  const tones = {
    primary: 'btn-primary',
    electric: 'btn-electric',
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
