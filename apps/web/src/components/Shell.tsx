'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { History, LayoutDashboard, ListChecks, LogOut, ScanLine, Search, Settings } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
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
      className="fixed inset-0 z-[120] flex items-start justify-center bg-ink/40 px-4 pt-[18vh]"
      onClick={onClose}
      role="dialog"
      aria-label="Command palette"
    >
      <div className="sticker w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b-2 border-ink px-5 py-4">
          <Search size={16} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && items.length) go(items[0][0]);
            }}
            placeholder="JUMP TO…"
            className="w-full bg-transparent font-mono text-sm font-bold uppercase tracking-[0.14em] outline-none placeholder:text-ink/40"
          />
          <kbd className="border border-ink/30 px-1.5 py-0.5 font-mono text-[10px]">ESC</kbd>
        </div>
        <ul className="max-h-72 overflow-y-auto p-2">
          {items.map(([href, label, hint, Icon]) => (
            <li key={href}>
              <button
                type="button"
                onClick={() => go(href)}
                className="flex w-full items-center gap-3 border-2 border-transparent px-3 py-3 text-left transition hover:border-ink hover:bg-hl/40"
              >
                <Icon size={16} />
                <span className="font-mono text-xs font-bold uppercase tracking-[0.18em]">{label}</span>
                <span className="ml-auto font-mono text-[11px] text-inksoft">{hint}</span>
              </button>
            </li>
          ))}
          {!items.length && <li className="px-4 py-6 text-center font-mono text-xs font-bold uppercase tracking-[0.2em] text-inksoft">No match.</li>}
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

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper text-ink">
      {/* Sidebar — fixed: bottom dock on mobile, left rail on desktop. Never scrolls. */}
      <aside className="fixed inset-x-0 bottom-0 z-[70] border-t-2 border-ink bg-paper lg:inset-y-0 lg:left-0 lg:right-auto lg:w-[76px] lg:border-r-2 lg:border-t-0">
        <div className="flex items-center justify-around px-2 py-2 lg:h-full lg:flex-col lg:justify-start lg:gap-1 lg:py-6">
          <Link href="/app" className="mb-0 hidden lg:mb-8 lg:block" aria-label="RTO Shield home">
            <LogoMark size={36} ink="#1B1712" pulse="#FF3B30" />
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
                className={`group relative grid h-12 w-12 place-items-center border-2 transition ${
                  active ? 'border-ink bg-hl shadow-sticker-sm' : 'border-transparent text-inksoft hover:border-ink hover:bg-white hover:text-ink'
                }`}
              >
                <Icon size={19} />
                <span className="pointer-events-none absolute left-[calc(100%+10px)] hidden whitespace-nowrap border-2 border-ink bg-white px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink opacity-0 shadow-sticker-sm transition group-hover:opacity-100 lg:block">
                  {label}
                </span>
                {active && <span className="absolute -left-2 top-1/2 hidden h-6 w-[4px] -translate-y-1/2 bg-risk lg:block" />}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={logout}
            title="Log out"
            aria-label="Log out"
            className="grid h-12 w-12 place-items-center text-inksoft transition hover:bg-risk hover:text-white lg:mt-auto"
          >
            <LogOut size={19} />
          </button>
        </div>
      </aside>

      {/* Right column — fixed viewport. Only <main> scrolls. */}
      <div className="flex min-h-0 flex-1 flex-col pb-[64px] lg:pb-0 lg:pl-[76px]">
        <header className="z-[60] shrink-0 border-b-2 border-ink bg-paper">
          <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/app" className="shrink-0 lg:hidden" aria-label="RTO Shield home">
                <LogoMark size={30} ink="#1B1712" pulse="#FF3B30" />
              </Link>
              {user ? (
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-extrabold uppercase tracking-[0.06em]">{user.shopName}</p>
                  <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-inksoft">
                    <span className="live-dot" /> Systems nominal
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5" aria-hidden="true">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPalette(true)}
              className="flex shrink-0 items-center gap-2.5 border-2 border-ink bg-white px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-inksoft shadow-sticker-sm transition hover:text-ink"
            >
              <Search size={13} />
              <span className="hidden sm:inline">Jump to…</span>
              <kbd className="border border-ink/30 bg-paper px-1.5 py-0.5 text-[10px]">⌘K</kbd>
            </button>
          </div>
        </header>

        {palette && <CommandPalette onClose={() => setPalette(false)} />}

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-paper">
          <div className="mx-auto max-w-page px-5 sm:px-8">
            <div className="pt-5">
              <StatusStrip status={status} />
            </div>
            {user ? (
              <div className="pb-16 pt-1">{children}</div>
            ) : (
              <div className="space-y-4 pb-16 pt-1" aria-busy="true" aria-label="Opening your shop">
                <Skeleton className="h-10 w-64" />
                <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
                <Skeleton className="h-56" />
              </div>
            )}
          </div>
        </main>
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
