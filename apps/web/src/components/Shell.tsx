'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { History, LayoutDashboard, ListChecks, LogOut, ScanLine, Search, Settings } from 'lucide-react';
import { Notice, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import type { Integrations, PublicUser } from '@/lib/types';

const links = [
  ['/app', 'Dashboard', 'Shop overview', LayoutDashboard],
  ['/app/history', 'History', 'Training orders', History],
  ['/app/orders', 'Scanner', 'Score orders', ScanLine],
  ['/app/queue', 'Queue', 'Confirm risky orders', ListChecks],
  ['/app/settings', 'Settings', 'Shop & keys', Settings],
] as const;

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items = links.filter(([href, label, hint]) =>
    `${label} ${hint} ${href}`.toLowerCase().includes(q.toLowerCase())
  );

  const go = useCallback((href: string) => {
    onClose();
    router.push(href);
  }, [onClose, router]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-black/80 px-4 pt-[18vh]"
      onClick={onClose}
      role="dialog"
      aria-label="Command palette"
    >
      <div className="panel w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <Search size={16} className="text-go" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && items.length) go(items[0][0]);
            }}
            placeholder="JUMP TO…"
            className="w-full bg-transparent font-mono text-sm uppercase tracking-[0.14em] text-white outline-none placeholder:text-muted/60"
          />
          <kbd className="border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted">ESC</kbd>
        </div>
        <ul className="max-h-72 overflow-y-auto p-2">
          {items.map(([href, label, hint, Icon]) => (
            <li key={href}>
              <button
                type="button"
                onClick={() => go(href)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-white/5"
              >
                <Icon size={16} className="text-go" />
                <span className="font-mono text-xs font-medium uppercase tracking-[0.18em]">{label}</span>
                <span className="ml-auto font-mono text-[11px] text-muted">{hint}</span>
              </button>
            </li>
          ))}
          {!items.length && <li className="px-4 py-6 text-center font-mono text-xs uppercase tracking-[0.2em] text-muted">No match.</li>}
        </ul>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<Integrations | null>(null);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    api<{ user: PublicUser }>('/auth/me')
      .then((body) => setUser(body.user))
      .catch(() => router.replace('/login'));
    api<Integrations>('/integrations')
      .then(setStatus)
      .catch(() => undefined);
  }, [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    router.replace('/');
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-page space-y-4 px-4 py-8" aria-busy="true" aria-label="Opening your shop">
        <Skeleton className="h-14" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black lg:grid lg:grid-cols-[76px_1fr]">
      <aside className="fixed inset-x-0 bottom-0 z-[70] border-t border-line bg-black/90 backdrop-blur-md lg:static lg:inset-auto lg:border-r lg:border-t-0 lg:bg-black lg:backdrop-blur-none">
        <div className="flex items-center justify-around px-2 py-2 lg:h-screen lg:flex-col lg:justify-start lg:gap-1 lg:px-0 lg:py-6">
          <Link href="/app" className="mb-0 hidden lg:mb-8 lg:block" aria-label="RTO Shield home">
            <span className="grid h-10 w-10 place-items-center bg-go font-display text-base font-black text-black">R</span>
          </Link>
          {links.map(([href, label, , Icon]) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={`group relative grid h-12 w-12 place-items-center transition ${
                  active ? 'bg-white/10 text-white' : 'text-muted hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={19} />
                <span className="pointer-events-none absolute left-[calc(100%+10px)] hidden whitespace-nowrap border border-line bg-panel px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white opacity-0 transition group-hover:opacity-100 lg:block">
                  {label}
                </span>
                {active && <span className="absolute left-0 top-1/2 hidden h-6 w-[3px] -translate-y-1/2 bg-go lg:block" />}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={logout}
            title="Log out"
            aria-label="Log out"
            className="grid h-12 w-12 place-items-center text-muted transition hover:bg-white/5 hover:text-signal lg:mt-auto"
          >
            <LogOut size={19} />
          </button>
        </div>
      </aside>

      <div className="pb-20 lg:pb-0">
        <div className="sticky top-0 z-[60] border-b border-line bg-black/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
            <div className="flex items-center gap-3">
              <Link href="/app" className="grid h-8 w-8 place-items-center bg-go font-display text-sm font-black text-black lg:hidden">
                R
              </Link>
              <div>
                <p className="truncate font-display text-sm font-extrabold uppercase tracking-[0.06em]">{user.shopName}</p>
                <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  <span className="live-dot" /> Systems nominal
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPalette(true)}
              className="flex items-center gap-2.5 border border-line px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted transition hover:border-white/40 hover:text-white"
            >
              <Search size={13} />
              <span className="hidden sm:inline">Jump to…</span>
              <kbd className="border border-line px-1.5 py-0.5 text-[10px]">⌘K</kbd>
            </button>
          </div>
        </div>

        {palette && <CommandPalette onClose={() => setPalette(false)} />}

        <div className="mx-auto max-w-page px-5 pt-5 sm:px-8">
          <StatusStrip status={status} />
        </div>
        <main className="mx-auto max-w-page px-5 pb-16 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

function StatusStrip({ status }: { status: Integrations | null }) {
  if (!status) return null;
  const notes = [
    status.encryption === 'development-fallback' ? 'Encryption key is unset. Set ENCRYPTION_KEY before real buyer data.' : null,
    status.mongodb === 'memory' ? 'Orders are in memory and disappear on restart.' : null,
    !status.ml.reachable ? 'The scoring service is not reachable. Uploads still save.' : null,
    status.ml.reachable && status.ml.activePredictor?.includes('sklearn')
      ? 'Scores use the scikit-learn fallback until TABPFN_TOKEN is set.'
      : null,
    status.ml.reachable && !status.ml.gemini && !status.ml.ollama
      ? 'Address notes and drafts use local templates until Gemma is configured.'
      : null,
  ].filter(Boolean);
  if (!notes.length) return null;
  return (
    <Notice>
      <ul className="space-y-1">
        {notes.map((note) => (
          <li key={note}>⚠ {note}</li>
        ))}
      </ul>
    </Notice>
  );
}
