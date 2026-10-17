'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { History, LayoutDashboard, ListChecks, LogOut, ScanLine, Search, Settings } from 'lucide-react';
import { Dock, type DockItem } from '@/components/Dock';
import { LogoMark } from '@/components/Logo';
import { Tour } from '@/components/Tour';
import { Notice, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { gemmaNotice } from '@/lib/ml-status';
import { prefetchRoute, qk, useIntegrations, useMe } from '@/lib/queries';
import { demoTour, sellerTour } from '@/lib/tours';
import type { Integrations, PublicUser } from '@/lib/types';

const links = [
  ['/app', 'Dashboard', 'Home', 'Shop overview', LayoutDashboard],
  ['/app/history', 'History', 'Hist', 'Training orders', History],
  ['/app/orders', 'Scanner', 'Scan', 'Score orders', ScanLine],
  ['/app/queue', 'Queue', 'Queue', 'Confirm risky orders', ListChecks],
  ['/app/settings', 'Settings', 'Set', 'Shop & keys', Settings],
] as const;

function activeNav(pathname: string, href: string) {
  if (href === '/app') return pathname === '/app';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const client = useQueryClient();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items = links.filter(([href, label, , hint]) =>
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
          {items.map(([href, label, , hint, Icon]) => (
            <li key={href}>
              <button
                type="button"
                onMouseEnter={() => prefetchRoute(client, href)}
                onFocus={() => prefetchRoute(client, href)}
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
  const client = useQueryClient();
  const me = useMe();
  const status = useIntegrations();
  const user = me.data ?? null;
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [tour, setTour] = useState<'seller' | 'demo' | null>(null);
  const tourStarted = useRef(false);

  useEffect(() => {
    if (me.isError) router.replace('/login');
  }, [me.isError, router]);

  useEffect(() => {
    if (!user || tourStarted.current || tour) return;
    if (user.role === 'demo' && !user.tour?.demoSeen) {
      tourStarted.current = true;
      setTour('demo');
    } else if (user.role !== 'demo' && !user.isDemo && !user.tour?.sellerSeen) {
      tourStarted.current = true;
      setTour('seller');
    }
  }, [user, tour]);

  const finishTour = useCallback(async () => {
    const kind = tour;
    setTour(null);
    if (!kind) return;
    try {
      await api('/tours/complete', { method: 'POST', body: JSON.stringify({ tour: kind }) });
      client.setQueryData<PublicUser>(qk.me, (current) =>
        current
          ? {
              ...current,
              tour: {
                sellerSeen: kind === 'seller' ? true : Boolean(current.tour?.sellerSeen),
                demoSeen: kind === 'demo' ? true : Boolean(current.tour?.demoSeen),
              },
            }
          : current,
      );
    } catch {
      // The help menu can replay the tour if the save misses.
    }
  }, [client, tour]);

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
    client.clear();
    router.replace('/');
  }

  const dockItems: DockItem[] = [
    ...links.map(([href, label, short, , Icon]) => ({
      id: href,
      href,
      label,
      short,
      icon: Icon,
      current: activeNav(pathname || '', href),
      onPrefetch: () => prefetchRoute(client, href),
    })),
    {
      id: 'logout',
      label: 'Log out',
      short: 'Out',
      icon: LogOut,
      onSelect: () => void logout(),
    },
  ];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper text-ink">
      <main className="min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto overscroll-contain bg-paper pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-page px-5 sm:px-8">
          <div className="flex items-center justify-between gap-3 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/app" className="shrink-0" aria-label="RTO Shield home" onMouseEnter={() => prefetchRoute(client, '/app')}>
                <LogoMark size={30} ink="#1B1712" pulse="#FF3B30" />
              </Link>
              {user ? (
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-display text-sm font-extrabold uppercase tracking-[0.06em]">{user.shopName}</p>
                    {user.role === 'demo' ? (
                      <span className="shrink-0 border-2 border-ink bg-hl px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]">
                        Demo account
                      </span>
                    ) : null}
                  </div>
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
            <div className="flex shrink-0 items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  aria-label="Help"
                  aria-expanded={help}
                  aria-haspopup="menu"
                  onClick={() => setHelp((open) => !open)}
                  className="grid h-11 w-11 place-items-center border-2 border-ink bg-white font-display text-lg font-extrabold shadow-sticker-sm"
                >
                  ?
                </button>
                {help ? (
                  <div role="menu" className="sticker absolute right-0 top-[calc(100%+8px)] z-[80] w-48 p-2">
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full px-3 py-2 text-left font-mono text-[11px] font-bold uppercase tracking-[0.14em] hover:bg-hl"
                      onClick={() => {
                        setHelp(false);
                        setTour(user?.role === 'demo' ? 'demo' : 'seller');
                      }}
                    >
                      Take the tour
                    </button>
                  </div>
                ) : null}
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
          </div>
          <StatusStrip status={status} sellerGemini={Boolean(user?.sellerGemini)} />
          {user ? (
            <div className="pb-8 pt-1">{children}</div>
          ) : (
            <div className="space-y-4 pb-8 pt-1" aria-busy="true" aria-label="Opening your shop">
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
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
      {tour ? <Tour steps={tour === 'demo' ? demoTour : sellerTour} onFinish={finishTour} /> : null}
      <Dock items={dockItems} label="Shop" placement="bottom" />
    </div>
  );
}

function StatusStrip({ status, sellerGemini }: { status: Integrations | null; sellerGemini: boolean }) {
  if (!status) return null;
  const notes = [
    status.encryption === 'development-fallback' ? 'Encryption key is unset. Set ENCRYPTION_KEY before real buyer data.' : null,
    status.mongodb === 'memory' ? 'Orders are in memory and disappear on restart.' : null,
    !status.ml.reachable ? 'The scoring service is not reachable. Uploads still save.' : null,
    status.ml.reachable && status.ml.activePredictor?.includes('sklearn')
      ? 'Scores use the scikit-learn fallback until TABPFN_TOKEN is set.'
      : null,
    gemmaNotice(status.ml, { sellerGemini })
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
