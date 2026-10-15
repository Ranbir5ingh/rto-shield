'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Notice } from '@/components/ui';
import { api } from '@/lib/api';
import type { Integrations, PublicUser } from '@/lib/types';

const links = [
  ['/app', 'Dashboard'],
  ['/app/history', 'History'],
  ['/app/orders', 'Score'],
  ['/app/queue', 'Queue'],
  ['/app/settings', 'Settings'],
];

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

  if (!user) return <p className="p-8 text-sm text-muted">Opening your shop…</p>;

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-20 bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <Link href="/app" className="text-lg font-medium tracking-tight">
              RTO Shield
            </Link>
            <p className="text-sm text-muted">{user.shopName}</p>
          </div>
          <button type="button" onClick={logout} className="text-sm text-muted hover:text-ink">
            Log out
          </button>
        </div>
        <nav className="mx-auto flex max-w-page gap-2 overflow-x-auto px-4 pb-3 text-sm sm:px-6">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`whitespace-nowrap rounded-full px-4 py-2 ${pathname === href ? 'bg-ink text-white' : 'bg-paper hover:bg-white'}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <div>
      <div className="mx-auto max-w-page space-y-3 px-4 py-4 sm:px-6">
        {status?.encryption === 'development-fallback' ? (
          <Notice>Encryption key is not set. This process is using a development key. Set ENCRYPTION_KEY before real buyer data.</Notice>
        ) : null}
        {status?.mongodb === 'memory' ? (
          <Notice>MongoDB URI is not set, so orders live in memory and disappear on restart.</Notice>
        ) : null}
        {status && !status.ml.reachable ? (
          <Notice>The scoring service is not reachable. Uploads still save. Start the ML service to score.</Notice>
        ) : null}
        {status?.ml.reachable && status.ml.activePredictor?.includes('sklearn') ? (
          <Notice tone="info">
            Scores use the scikit-learn fallback. Set TABPFN_TOKEN to train TabPFN in-context on this shop, or install the local tabpfn package.
          </Notice>
        ) : null}
        {status?.ml.reachable && !status.ml.gemini && !status.ml.ollama ? (
          <Notice tone="info">
            Address notes and confirmation drafts use local rules and templates. OLLAMA_BASE_URL is the privacy-max Gemma path. GEMINI_API_KEY uses Gemma on AI Studio.
          </Notice>
        ) : null}
      </div>
      <main className="mx-auto max-w-page px-4 pb-16 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
