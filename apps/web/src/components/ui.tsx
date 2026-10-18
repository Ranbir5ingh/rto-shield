'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-ink/10 ${className}`} aria-hidden="true" />;
}

export function Eyebrow({ children, className = '', ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`eyebrow ${className}`} {...props}>{children}</p>;
}

export function LabelChip({ children, className = '', ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={`label-chip ${className}`} {...props}>{children}</span>;
}

export function Flag({ tone = 'red', children }: { tone?: 'red' | 'banana' | 'go' | 'ghost'; children: ReactNode }) {
  const cls = tone === 'red' ? 'flag flag-red' : tone === 'banana' ? 'flag flag-banana' : tone === 'go' ? 'flag flag-go' : 'flag flag-ghost';
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
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'go' | 'ghost' | 'dark' | 'pink'; tone?: 'ghost' | 'danger' }) {
  const v = tone === 'ghost' ? 'ghost' : tone === 'danger' ? 'danger' : variant;
  const cls =
    v === 'go'
      ? 'btn-go'
      : v === 'pink'
        ? 'btn-pink'
        : v === 'danger'
          ? 'btn-ghost !text-risk'
          : 'btn-ghost';
  return (
    <button type="button" className={`${cls} disabled:opacity-50 ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`sticker ${className}`}>{children}</div>;
}

export function Notice({ children, tone = 'warn' }: { children: ReactNode; tone?: 'warn' | 'good' }) {
  return (
    <div className={`sticker-sm px-5 py-4 ${tone === 'good' ? '!bg-lime/30' : '!bg-hl/40'}`} role="status">
      <div className="font-mono text-xs leading-6 text-ink/80">{children}</div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="sticker px-6 py-14 text-center">
      <p className="eyebrow">EMPTY</p>
      <p className="mt-4 font-display text-2xl font-black uppercase tracking-tight">{title}</p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-inksoft">{body}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="sticker-sm p-5">
      <p className="eyebrow">{label}</p>
      <p className="mt-3 font-display text-5xl font-black tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-2 font-mono text-xs leading-5 text-inksoft">{hint}</p> : null}
    </div>
  );
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <div className="mt-2.5">{children}</div>
      {error ? <span className="mt-2 block font-mono text-xs leading-5 text-risk" role="alert">{error}</span> : null}
      {hint ? <span className="mt-2 block font-mono text-xs leading-5 text-inksoft">{hint}</span> : null}
    </label>
  );
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-6 sm:grid-cols-2">{children}</div>;
}

const inputCls = 'input-paper';

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
  reveal,
  listTour,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  /** data-tour-open value so the product tour can open this menu. */
  reveal?: string;
  /** data-tour value on the open list. */
  listTour?: string;
}) {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target;
      if (target instanceof Element && target.closest('#tour-card')) return;
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      // The tour closes this menu itself on Escape. A second close would toggle it open again.
      if (e.key === 'Escape' && !document.getElementById('tour-card')) setOpen(false);
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
        data-tour-open={reveal}
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
        <span className={selected ? 'text-ink' : 'text-ink/40'}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={15} className={`shrink-0 text-inksoft transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={label}
          data-tour={listTour}
          className="absolute inset-x-0 z-50 mt-2 max-h-64 overflow-y-auto border-2 border-ink bg-white py-1 shadow-sticker"
        >
          {options.map((o, i) => {
            const active = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={active} className="opt-in" style={{ animationDelay: `${i * 35}ms` }}>
                <button
                  type="button"
                  data-tour={listTour ? `lang-${o.value}` : undefined}
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
                    i === focusIdx ? 'bg-hl/60 text-ink' : active ? 'bg-lime/40 text-ink' : 'text-ink/70 hover:bg-paper'
                  }`}
                >
                  {o.label}
                  {active && <Check size={14} />}
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
    <th className={`whitespace-nowrap px-4 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-inksoft ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3.5 align-top text-sm ${className}`}>{children}</td>;
}

export function Tr({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <tr className={`border-t-2 border-dashed border-ink/15 transition hover:bg-hl/20 ${className}`}>{children}</tr>;
}

export function CopyButton({ text, label = 'Copy', tour }: { text: string; label?: string; tour?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const empty = !text;
  return (
    <button
      type="button"
      data-tour={tour}
      disabled={empty}
      aria-live="polite"
      onClick={() => {
        if (empty) return;
        const done = (next: 'copied' | 'failed') => {
          setState(next);
          window.setTimeout(() => setState('idle'), 1600);
        };
        if (!navigator.clipboard?.writeText) {
          done('failed');
          return;
        }
        void navigator.clipboard.writeText(text).then(
          () => done('copied'),
          () => done('failed'),
        );
      }}
      className={`font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink underline decoration-hl decoration-2 underline-offset-4 transition hover:decoration-ink ${
        state === 'copied' ? 'border-2 border-ink bg-lime px-2 py-1 no-underline' : ''
      }`}
    >
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy' : label}
    </button>
  );
}

/* ---------- paper-tear collage primitives ---------- */

export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 border-2 border-ink bg-paper px-3 py-2">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
        {start}–{end} of {total}
      </p>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost !px-3 !py-2 !text-[10px]" disabled={page <= 0} onClick={() => onPage(page - 1)}>
          Prev
        </button>
        <button type="button" className="btn-ghost !px-3 !py-2 !text-[10px]" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

export function Tape({ className = '', pink = false, sky = false, lime = false }: { className?: string; pink?: boolean; sky?: boolean; lime?: boolean }) {
  const tone = pink ? 'tape-pink' : sky ? 'tape-sky' : lime ? 'tape-lime' : '';
  return <span className={`tape ${tone} ${className}`} aria-hidden="true" />;
}

export function DoodleStar({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" />
    </svg>
  );
}

export function DoodleArrow({ className = '', flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg viewBox="0 0 100 40" className={className} aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M4 30 C 30 32, 55 28, 78 12 M78 12 l-9 1 M78 12 l2 9" className="doodle-arrow" />
    </svg>
  );
}

/* ---------- app page primitives (dashboard layout system) ---------- */

/** Consistent page frame: max-width, gutters, header hierarchy. The page
 *  scroller lives in Shell; pages only own their inner padding. */
export function Page({
  eyebrow,
  title,
  sub,
  actions,
  children,
  className = '',
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-10 ${className}`}>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 py-6 lg:py-8">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow text-inksoft">{eyebrow}</p> : null}
          <h1 className="mt-2 font-display text-[1.7rem] font-black uppercase leading-[1.02] tracking-tight md:text-4xl">
            {title}
          </h1>
          {sub ? <p className="mt-3 max-w-2xl text-[15px] leading-7 text-ink/70">{sub}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
      </header>
      <div className="space-y-6 pb-12 lg:space-y-8 lg:pb-16">{children}</div>
    </div>
  );
}

/** A separated content section: sticker card with eyebrow + title header. */
export function Section({
  eyebrow,
  title,
  action,
  children,
  className = '',
  pad = true,
  tour,
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
  tour?: string;
}) {
  return (
    <section className={`sticker ${className}`} data-tour={tour}>
      {(eyebrow || title || action) && (
        <div className={`flex flex-wrap items-start justify-between gap-3 ${pad ? 'p-5 sm:p-6 lg:p-7' : 'px-5 pt-5 sm:px-6 sm:pt-6 lg:px-7 lg:pt-7'} pb-0`}>
          <div className="min-w-0">
            {eyebrow ? <p className="eyebrow text-inksoft">{eyebrow}</p> : null}
            {title ? (
              <h2 className="mt-2 font-display text-xl font-extrabold uppercase tracking-tight md:text-2xl">
                {title}
              </h2>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      <div className={pad ? 'p-5 sm:p-6 lg:p-7' : ''}>{children}</div>
    </section>
  );
}
