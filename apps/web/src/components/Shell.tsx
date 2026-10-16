'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { History, LayoutDashboard, ListChecks, LogOut, ScanLine, Settings } from 'lucide-react';
import { Notice, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import type { Integrations, PublicUser } from '@/lib/types';

const links = [
  ['/app', 'DASHBOARD', LayoutDashboard],
  ['/app/history', 'HISTORY', History],
  ['/app/orders', 'SCANNER', ScanLine],
  ['/app/queue', 'QUEUE', ListChecks],
  ['/app/settings', 'SETTINGS', Settings],
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<Integrations | null>(null);

  useEffect(() => {
    api<{ user: PublicUser }>('/auth/me')
      .then((body) => setUser(body.user))
      .catch(() => router.replace('/login'));
    api<Integrations>('/integrations')
      .then(setStatus)
      .catch(() => undefined);
  }, [router]);

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
    <div className="px-grid min-h-screen bg-void lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-b-2 border-lime lg:border-b-0 lg:border-r-2">
        <div className="flex items-center justify-between gap-3 px-4 py-4 lg:block">
          <Link href="/app" className="flex items-center gap-2">
            <span className="font-display text-lg font-bold text-lime">RTO▲SHIELD</span>
          </Link>
          <p className="truncate font-mono text-xs text-muted lg:mt-2">{user.shopName}</p>
        </div>
        <nav className="flex flex-wrap gap-2 px-3 pb-3 lg:block lg:space-y-2 lg:px-3">
          {links.map(([href, label, Icon]) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`px-cut-sm flex items-center gap-2.5 whitespace-nowrap border-2 px-3 py-2.5 font-mono text-xs font-bold tracking-wider transition ${
                  active
                    ? 'border-lime bg-lime text-void shadow-px'
                    : 'border-transparent text-muted hover:border-line hover:text-ink'
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={logout}
          className="m-3 hidden items-center gap-2 font-mono text-xs text-muted transition hover:text-danger lg:flex"
        >
          <LogOut size={14} /> LOG OUT
        </button>
      </aside>
      <div>
        <div className="flex justify-end px-4 pt-3 lg:hidden">
          <button type="button" onClick={logout} className="font-mono text-xs text-muted">
            LOG OUT
          </button>
        </div>
        <div className="mx-auto max-w-page px-4 pt-4 sm:px-6">
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
