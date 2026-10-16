'use client';

import { useState, type ReactNode } from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-white/5 ${className}`} aria-hidden="true" />;
}

export function Eyebrow({ children, className = '', ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`eyebrow ${className}`} {...props}>{children}</p>;
}

export function LabelChip({ children, className = '', ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={`label-chip ${className}`} {...props}>{children}</span>;
}

export function Flag({ tone = 'red', children }: { tone?: 'red' | 'banana' | 'go' | 'ghost'; children: ReactNode }) {
  const cls = tone === 'red' ? 'flag' : tone === 'banana' ? 'flag flag-banana' : tone === 'go' ? 'flag flag-go' : 'flag flag-ghost';
  return <span className={cls}>{children}</span>;
}

export function RiskBadge({ band }: { band: 'Low' | 'Medium' | 'High' | null }) {
  if (band === 'High') return <Flag tone="red">High</Flag>;
  if (band === 'Medium') return <Flag tone="banana">Medium</Flag>;
  if (band === 'Low') return <Flag tone="go">Low</Flag>;
  return <Flag tone="ghost">—</Flag>;
}

export function Button({
  children,
  variant = 'go',
  tone,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'go' | 'ghost' | 'dark'; tone?: 'ghost' | 'danger' }) {
  const v = tone === 'ghost' ? 'ghost' : tone === 'danger' ? 'danger' : variant;
  const cls =
    v === 'go'
      ? 'btn-go'
      : v === 'danger'
        ? 'btn-ghost !text-signal hover:!border-signal'
        : 'btn-ghost';
  return (
    <button type="button" className={`${cls} disabled:opacity-50 ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`panel ${className}`}>{children}</div>;
}

export function Notice({ children, tone = 'warn' }: { children: ReactNode; tone?: 'warn' | 'good' }) {
  return (
    <div className={`panel px-5 py-4 ${tone === 'good' ? 'border-l-2 border-l-go' : 'border-l-2 border-l-signal'}`} role="status">
      <div className="font-mono text-xs leading-6 text-ink/80">{children}</div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="panel px-6 py-14 text-center">
      <p className="eyebrow">EMPTY</p>
      <p className="mt-4 font-display text-2xl font-extrabold uppercase tracking-tight">{title}</p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel-flat pt-5">
      <p className="eyebrow">{label}</p>
      <p className="mt-3 font-display text-5xl font-extrabold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-2 font-mono text-xs leading-5 text-muted">{hint}</p> : null}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <div className="mt-2.5">{children}</div>
      {hint ? <span className="mt-2 block font-mono text-xs leading-5 text-muted">{hint}</span> : null}
    </label>
  );
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-6 sm:grid-cols-2">{children}</div>;
}

const inputCls =
  'w-full bg-black border border-line px-4 py-3.5 text-[15px] text-ink placeholder:text-muted/50 outline-none transition focus:border-go';

export const inputClass = inputCls;

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <th className={`whitespace-nowrap px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3.5 align-top text-sm ${className}`}>{children}</td>;
}

export function Tr({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <tr className={`border-t border-line transition hover:bg-white/[0.03] ${className}`}>{children}</tr>;
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
      className="font-mono text-[11px] uppercase tracking-[0.18em] text-go transition hover:brightness-125"
    >
      {copied ? 'Copied' : label}
    </button>
  );
}
