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
      className="fixed inset-0 z-[120] flex items-start justify-center bg-void/70 px-4 pt-[18vh] backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label="Command palette"
    >
      <div
        className="card w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
          <Search size={16} className="text-gold" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && items.length) go(items[0][0]);
            }}
            placeholder="Jump to…"
            className="w-full bg-transparent font-mono text-sm text-ink outline-none placeholder:text-muted/60"
          />
          <kbd className="rounded border border-white/12 px-1.5 py-0.5 font-mono text-[10px] text-muted">ESC</kbd>
        </div>
        <ul className="max-h-72 overflow-y-auto p-2">
          {items.map(([href, label, hint, Icon]) => (
            <li key={href}>
              <button
                type="button"
                onClick={() => go(href)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-gold/10"
              >
                <Icon size={16} className="text-gold" />
                <span className="font-semibold">{label}</span>
                <span className="ml-auto font-mono text-xs text-muted">{hint}</span>
              </button>
            </li>
          ))}
          {!items.length && <li className="px-4 py-6 text-center font-mono text-sm text-muted">No match.</li>}
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
    <div className="min-h-screen bg-void lg:grid lg:grid-cols-[76px_1fr]">
      {/* Icon rail */}
      <aside className="fixed inset-x-0 bottom-0 z-[70] border-t border-white/10 bg-void/85 backdrop-blur-xl lg:static lg:inset-auto lg:border-r lg:border-t-0 lg:bg-transparent lg:backdrop-blur-none">
        <div className="flex items-center justify-around px-2 py-2 lg:h-screen lg:flex-col lg:justify-start lg:gap-2 lg:px-0 lg:py-6">
          <Link href="/app" className="mb-0 hidden lg:mb-6 lg:block" aria-label="RTO Shield home">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-goldlight to-accent-deep font-display text-lg font-extrabold text-void shadow-glow">
              R
            </span>
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
                className={`group relative grid h-12 w-12 place-items-center rounded-2xl transition ${
                  active
                    ? 'bg-gold/15 text-gold shadow-glow'
                    : 'text-muted hover:bg-white/6 hover:text-ink'
                }`}
              >
                <Icon size={19} />
                <span className="pointer-events-none absolute left-[calc(100%+10px)] hidden whitespace-nowrap rounded-lg border border-white/10 bg-panel px-2.5 py-1.5 font-mono text-xs text-ink opacity-0 transition group-hover:opacity-100 lg:block">
                  {label}
                </span>
                {active && <span className="absolute -left-px top-1/2 hidden h-6 w-[3px] -translate-y-1/2 rounded-full bg-gold lg:block" />}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={logout}
            title="Log out"
            aria-label="Log out"
            className="grid h-12 w-12 place-items-center rounded-2xl text-muted transition hover:bg-white/6 hover:text-signal lg:mt-auto"
          >
            <LogOut size={19} />
          </button>
        </div>
      </aside>

      <div className="pb-20 lg:pb-0">
        {/* Top HUD bar */}
        <div className="sticky top-0 z-[60] border-b border-white/8 bg-void/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
            <div className="flex items-center gap-3">
              <Link href="/app" className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-goldlight to-accent-deep font-display text-sm font-extrabold text-void lg:hidden">
                R
              </Link>
              <div>
                <p className="truncate font-display text-base font-bold tracking-tight">{user.shopName}</p>
                <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
                  <span className="live-dot" /> SYSTEMS NOMINAL
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPalette(true)}
              className="flex items-center gap-2.5 rounded-full border border-white/12 bg-white/4 px-4 py-2 font-mono text-xs text-muted transition hover:border-gold/50 hover:text-ink"
            >
              <Search size={13} />
              <span className="hidden sm:inline">Jump to…</span>
              <kbd className="rounded border border-white/12 px-1.5 py-0.5 text-[10px]">⌘K</kbd>
            </button>
          </div>
        </div>

        {palette && <CommandPalette onClose={() => setPalette(false)} />}

        <div className="mx-auto max-w-page px-4 pt-5 sm:px-6">
          <StatusStrip status={status} />
        </div>
        <main className="mx-auto max-w-page px-4 pb-16 sm:px-6">{children}</main>
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
