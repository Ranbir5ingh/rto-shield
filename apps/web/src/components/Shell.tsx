'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { History, LayoutDashboard, ListChecks, LogOut, PanelLeftClose, PanelLeftOpen, ScanLine, Search, Settings } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { Tour } from '@/components/Tour';
import { Notice, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { gemmaNotice } from '@/lib/ml-status';
import { prefetchRoute, qk, useIntegrations, useMe, useQueue, useShopify } from '@/lib/queries';
import { isDemoSession, toursFor, type TourKind, type TourSurface } from '@/lib/tours';
import type { Integrations, PublicUser } from '@/lib/types';

const links = [
  ['/app', 'Dashboard', 'Shop overview', LayoutDashboard],
  ['/app/queue', 'Queue', 'Confirm risky orders', ListChecks],
  ['/app/orders', 'Scanner', 'Score orders', ScanLine],
  ['/app/history', 'History', 'Training orders', History],
  ['/app/settings', 'Settings', 'Shop & keys', Settings],
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

  const items = links.filter(([href, label, hint]) =>
    `${label} ${hint} ${href}`.toLowerCase().includes(q.toLowerCase())
  );

  const go = useCallback((href: string) => {
    onClose();
    router.push(href);
  }, [onClose, router]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-6"
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
        <ul className="max-h-[min(18rem,calc(100dvh-8rem))] overflow-y-auto p-2">
          {items.map(([href, label, hint, Icon]) => (
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
  const queue = useQueue();
  const shopify = useShopify();
  const user = me.data ?? null;
  const shopifyConnected = Boolean(shopify.data?.connected);
  const queueCount = queue.data?.orders.length ?? 0;
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [tour, setTour] = useState<TourKind | null>(null);
  const [tourNonce, setTourNonce] = useState(0);
  const [surface, setSurface] = useState<TourSurface | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('rto-sidebar') === 'collapsed';
  });
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);
  const tourStarted = useRef(false);
  const tourSteps = useMemo(
    () => (tour && surface ? toursFor(tour, surface, 'english', { shopifyConnected }) : null),
    [tour, surface, shopifyConnected],
  );

  useEffect(() => {
    window.localStorage.setItem('rto-sidebar', collapsed ? 'collapsed' : 'open');
  }, [collapsed]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const apply = () => setSurface(media.matches ? 'desktop' : 'mobile');
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (me.isError) router.replace('/login');
  }, [me.isError, router]);

  useEffect(() => {
    if (!user || tourStarted.current || tour) return;
    // The step list depends on whether Shopify is already linked. Wait so the
    // first card never looks for a connect control that is not on the page.
    if (!shopify.isFetched) return;
    const demoSession = isDemoSession(user);
    if (demoSession && !user.tour?.demoSeen) {
      tourStarted.current = true;
      setTour('demo');
    } else if (!demoSession && !user.tour?.sellerSeen) {
      tourStarted.current = true;
      setTour('seller');
    }
  }, [user, tour, shopify.isFetched]);

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

  const fill = pathname === '/app/queue';

  return (
    <div className="flex h-dvh overflow-hidden bg-paper text-ink">
      {/* ------- desktop sidebar (collapsible icon rail) ------- */}
      <aside
        className={`relative hidden shrink-0 flex-col border-r-2 border-ink bg-paper transition-[width] duration-200 ease-out lg:flex ${
          collapsed ? 'w-[4.5rem]' : 'w-60'
        }`}
        aria-label="Primary"
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className="absolute -right-[19px] top-1/2 z-30 grid h-9 w-9 -translate-y-1/2 place-items-center border-2 border-ink bg-hl text-ink shadow-sticker-sm transition hover:rotate-[-8deg]"
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
        <div className={`flex h-16 items-center border-b-2 border-ink ${collapsed ? 'justify-center px-0' : 'px-5'}`}>
          <Link
            href="/app"
            className="flex shrink-0 items-center gap-3"
            onMouseEnter={() => prefetchRoute(client, '/app')}
            aria-label="RTO Shield home"
          >
            <LogoMark size={32} ink="#1B1712" pulse="#FF3B30" />
            {collapsed ? null : (
              <span className="whitespace-nowrap font-display text-lg font-black uppercase tracking-tight">
                RTO<span className="text-risk">&nbsp;Shield</span>
              </span>
            )}
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-3" aria-label="Sections">
          {links.map(([href, label, , Icon]) => {
            const active = activeNav(pathname || '', href);
            const badge = href === '/app/queue' && queueCount > 0;
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                onMouseEnter={(e) => {
                  prefetchRoute(client, href);
                  if (collapsed) {
                    const r = e.currentTarget.getBoundingClientRect();
                    setTip({ label, top: r.top + r.height / 2 });
                  }
                }}
                onMouseLeave={() => setTip(null)}
                onFocus={(e) => {
                  if (collapsed) {
                    const r = e.currentTarget.getBoundingClientRect();
                    setTip({ label, top: r.top + r.height / 2 });
                  }
                }}
                onBlur={() => setTip(null)}
                className={`relative flex items-center border-2 transition ${
                  collapsed ? 'mx-auto h-11 w-11 justify-center' : 'gap-3 px-3.5 py-3'
                } ${
                  active
                    ? 'border-ink bg-lime shadow-sticker-sm'
                    : 'border-transparent hover:border-ink hover:bg-hl/40'
                }`}
              >
                <Icon size={17} aria-hidden="true" className="shrink-0" />
                {collapsed ? null : (
                  <span className="whitespace-nowrap font-mono text-xs font-bold uppercase tracking-[0.14em]">{label}</span>
                )}
                {badge ? (
                  collapsed ? (
                    <span className="absolute -right-2 -top-2 z-10 grid h-5 min-w-5 place-items-center border-2 border-ink bg-risk px-1 font-mono text-[9px] font-bold leading-none text-white">
                      {queueCount > 99 ? '99+' : queueCount}
                    </span>
                  ) : (
                    <span className="ml-auto border-2 border-ink bg-risk px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                      {queueCount > 99 ? '99+' : queueCount}
                    </span>
                  )
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className={`border-t-2 border-ink p-3 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
          {user && !collapsed ? (
            <div className="mb-2 px-1.5">
              <p className="truncate font-display text-sm font-extrabold uppercase">{user.shopName}</p>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-inksoft">
                {isDemoSession(user) ? 'Demo account' : 'Seller'}
              </p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void logout()}
            aria-label="Log out"
            onMouseEnter={(e) => {
              if (collapsed) {
                const r = e.currentTarget.getBoundingClientRect();
                setTip({ label: 'Log out', top: r.top + r.height / 2 });
              }
            }}
            onMouseLeave={() => setTip(null)}
            className={`flex items-center border-2 border-transparent font-mono text-xs font-bold uppercase tracking-[0.14em] text-inksoft transition hover:border-ink hover:bg-hl/40 hover:text-ink ${
              collapsed ? 'justify-center px-0 py-3 w-full' : 'w-full gap-3 px-3.5 py-3'
            }`}
          >
            <LogOut size={17} aria-hidden="true" className="shrink-0" />
            {collapsed ? null : 'Log out'}
          </button>
        </div>
      </aside>
      {tip && collapsed
        ? createPortal(
            <span
              className="pointer-events-none fixed z-[100] -translate-y-1/2 whitespace-nowrap border-2 border-ink bg-paper px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink shadow-sticker-sm"
              style={{ left: '4.9rem', top: tip.top }}
              role="tooltip"
            >
              {tip.label}
            </span>,
            document.body,
          )
        : null}

      {/* ------- main column ------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* topbar */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b-2 border-ink bg-paper px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/app" className="shrink-0 lg:hidden" aria-label="RTO Shield home">
              <LogoMark size={30} ink="#1B1712" pulse="#FF3B30" />
            </Link>
            {user ? (
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-display text-sm font-extrabold uppercase tracking-[0.06em]">{user.shopName}</p>
                  {isDemoSession(user) ? (
                    <span className="shrink-0 border-2 border-ink bg-hl px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]">
                      Demo
                    </span>
                  ) : null}
                </div>
                <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-inksoft">
                  <span className="live-dot" /> Systems nominal
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2" aria-hidden="true">
                <Skeleton className="h-4 w-40" />
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
                className="grid h-10 w-10 place-items-center border-2 border-ink bg-white font-display text-base font-extrabold shadow-sticker-sm"
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
                      setTour(isDemoSession(user) ? 'demo' : 'seller');
                      setTourNonce((nonce) => nonce + 1);
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
              className="hidden items-center gap-2.5 border-2 border-ink bg-white px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-inksoft shadow-sticker-sm transition hover:text-ink sm:flex"
            >
              <Search size={13} />
              <span className="hidden md:inline">Jump to…</span>
              <kbd className="border border-ink/30 bg-paper px-1.5 py-0.5 text-[10px]">⌘K</kbd>
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              aria-label="Log out"
              className="grid h-10 w-10 place-items-center border-2 border-ink bg-white text-inksoft shadow-sticker-sm transition hover:text-ink lg:hidden"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <StatusStrip status={status} sellerGemini={Boolean(user?.sellerGemini)} />

        {/* page scroller — full-bleed so the scrollbar hugs the viewport edge */}
        <main
          id="app-main"
          className={
            fill
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
              : 'min-h-0 flex-1 overflow-y-auto overscroll-contain'
          }
        >
          {user ? (
            children
          ) : (
            <div className="mx-auto w-full max-w-page space-y-4 px-4 py-8 sm:px-6" aria-busy="true" aria-label="Opening your shop">
              <Skeleton className="h-10 w-64" />
              <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
              <Skeleton className="h-56" />
            </div>
          )}
        </main>

        {/* ------- mobile bottom nav ------- */}
        <nav aria-label="Primary" className="shrink-0 border-t-2 border-ink bg-paper lg:hidden">
          <div className="grid grid-cols-5" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {links.map(([href, label, , Icon]) => {
              const active = activeNav(pathname || '', href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  onMouseEnter={() => prefetchRoute(client, href)}
                  className={`relative flex flex-col items-center gap-1 py-2.5 ${
                    active ? 'bg-lime' : ''
                  }`}
                >
                  {href === '/app/queue' && queueCount > 0 ? (
                    <span className="absolute right-3 top-1 border border-ink bg-risk px-1 font-mono text-[9px] font-bold text-white">
                      {queueCount}
                    </span>
                  ) : null}
                  <Icon size={19} aria-hidden="true" />
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em]">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {palette && <CommandPalette onClose={() => setPalette(false)} />}
      {tourSteps ? <Tour key={`${tour}-${surface}-${tourNonce}`} steps={tourSteps} onFinish={finishTour} /> : null}
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
    <div className="shrink-0 border-b-2 border-ink bg-hl/40 px-4 py-2.5 sm:px-6">
      <div className="mx-auto w-full max-w-page">
        <Notice>
          <ul className="space-y-1">
            {notes.map((note) => (
              <li key={note}>⚠ {note}</li>
            ))}
          </ul>
        </Notice>
      </div>
    </div>
  );
}
