'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';

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

export function Dropdown({
  value,
  options,
  onChange,
  label,
  placeholder = '—',
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setFocusIdx(-1);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
            setFocusIdx(Math.max(0, options.findIndex((o) => o.value === value)));
          }
        }}
        className={`${inputCls} flex cursor-pointer items-center justify-between gap-3 text-left`}
      >
        <span className={selected ? 'text-white' : 'text-muted/60'}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={15} className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 z-50 mt-2 max-h-64 overflow-y-auto border border-line bg-panel py-1 shadow-[0_16px_48px_rgba(0,0,0,0.8)]"
        >
          {options.map((o, i) => {
            const active = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => pick(o.value)}
                  onMouseEnter={() => setFocusIdx(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setFocusIdx((f) => Math.min(options.length - 1, f + 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setFocusIdx((f) => Math.max(0, f - 1));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      pick(options[focusIdx >= 0 ? focusIdx : i].value);
                    }
                  }}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left font-mono text-xs uppercase tracking-[0.14em] transition ${
                    i === focusIdx ? 'bg-white/10 text-white' : active ? 'text-go' : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {o.label}
                  {active && <Check size={14} className="text-go" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
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
