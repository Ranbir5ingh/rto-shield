'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useToast } from '@/components/Toaster';
import { WhatsAppSetupGuide } from '@/components/WhatsAppGuide';
import { Button, Field, Notice, inputClass } from '@/components/ui';
import type { GuideProgressInput } from '@/lib/whatsapp-guide';
import { ApiError, api } from '@/lib/api';

interface ShopifyStatus {
  connected: boolean;
  demo: boolean;
  shop: string | null;
  backfill: { status: string; processed: number; total: number; error: string | null };
}

function StartForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [shop, setShop] = useState('');
  const [pending, setPending] = useState(false);
  const [samplePending, setSamplePending] = useState(false);
  const toast = useToast();
  const [link, setLink] = useState<ShopifyStatus | null>(null);
  const [whatsapp, setWhatsapp] = useState<
    (GuideProgressInput & { callbackUrl?: string; verifyToken?: string }) | null
  >(null);

  useEffect(() => {
    if (params?.get('shopify') === 'error') toast.error('Shopify did not finish the install. Start again from the shop domain.');
  }, [params, toast]);

  useEffect(() => {
    let stop = false;
    let timer = 0;
    async function pull() {
      try {
        const [body, wa] = await Promise.all([
          api<ShopifyStatus>('/shopify'),
          api<GuideProgressInput & { callbackUrl?: string; verifyToken?: string }>('/whatsapp').catch(() => null),
        ]);
        if (stop) return;
        setLink(body);
        if (wa) setWhatsapp(wa);
        if (body.connected && body.backfill.status === 'running') timer = window.setTimeout(() => void pull(), 2000);
      } catch {
        if (!stop) setLink(null);
      }
    }
    void pull();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, []);

  async function connect(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const body = await api<{ url: string }>('/shopify/install', { method: 'POST', body: JSON.stringify({ shop }) });
      window.location.assign(body.url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not start Shopify');
      setPending(false);
    }
  }

  async function sample() {
    setSamplePending(true);
    try {
      await api('/orders/sample', { method: 'POST' });
      await api('/orders/score', { method: 'POST' });
      router.push('/app');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not prepare the sample shop');
      setSamplePending(false);
    }
  }

  const progress = link?.backfill.total ? Math.round((link.backfill.processed / link.backfill.total) * 100) : link?.backfill.status === 'done' ? 100 : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-inksoft">Shop setup</p>
      <h1 className="font-display text-display-2">Connect the shop.</h1>
      <p className="text-sm leading-7 text-ink/75">
        Shopify pulls the last 60 days and keeps scoring new orders. A CSV is still there if you want it. Phones stay encrypted.
      </p>
      {link?.connected ? (
        <article className="panel p-5" data-tour="shopify-connected">
          <h2 className="font-display text-2xl">{link.demo ? 'Demo store' : link.shop}</h2>
          <p className="mt-2 text-sm text-ink/70">
            {link.backfill.status === 'running'
              ? `Reading orders… ${link.backfill.processed}`
              : link.backfill.status === 'done'
                ? `${link.backfill.processed} orders ready to score.`
                : link.backfill.status === 'error'
                  ? 'Shopify stopped the import.'
                  : 'Waiting to read orders.'}
          </p>
          {link.backfill.status === 'error' ? (
            <div className="mt-3">
              <Notice>{link.backfill.error || 'Shopify could not finish the import.'}</Notice>
            </div>
          ) : null}
          <div className="mt-4 h-2 border-2 border-ink bg-white">
            <div className="h-full bg-lime" style={{ width: `${progress}%` }} />
          </div>
          {link.backfill.status === 'done' ? (
            <Link href="/app" className="btn-go mt-4 inline-flex">
              See the first scores
            </Link>
          ) : null}
        </article>
      ) : (
        <form onSubmit={connect} className="panel space-y-3 p-5" data-tour="shopify-connect">
          <h2 className="font-display text-2xl">Connect Shopify</h2>
          <Field label="Shop domain">
            <input
              className={inputClass}
              value={shop}
              onChange={(event) => setShop(event.target.value)}
              placeholder="your-store.myshopify.com"
              autoComplete="off"
              required
            />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? 'Opening Shopify…' : 'Connect Shopify'}
          </Button>
        </form>
      )}
      <article className="panel p-5" data-tour="whatsapp-card">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl">WhatsApp</h2>
          <WhatsAppSetupGuide
            callbackUrl={whatsapp?.callbackUrl || ''}
            verifyToken={whatsapp?.verifyToken || ''}
            progress={whatsapp || {}}
          />
        </div>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          Your own Cloud API number. The setup guide walks through Meta, then you paste the token in Settings.
        </p>
        <Link href="/app/settings" className="btn btn-ghost mt-4">
          Open WhatsApp settings
        </Link>
      </article>
      <div className="grid gap-4 sm:grid-cols-2" data-tour="import-alternatives">
        <article className="panel p-5">
          <h2 className="font-display text-2xl">CSV, if you must</h2>
          <p className="mt-2 text-sm leading-6 text-ink/70">A Shopify export, a Meesho-style file, or the generic template.</p>
          <Link href="/app/history" className="btn btn-ghost mt-4">
            Upload history
          </Link>
        </article>
        <article className="panel p-5">
          <h2 className="font-display text-2xl">Sample shop</h2>
          <p className="mt-2 text-sm leading-6 text-ink/70">Invented buyers, so you can see a score without a store.</p>
          <Button type="button" className="mt-4" tone="ghost" onClick={sample} disabled={samplePending}>
            {samplePending ? 'Scoring sample orders…' : 'Load and score'}
          </Button>
        </article>
      </div>
    </div>
  );
}

export default function StartPage() {
  return (
    <Suspense fallback={<div className="skeleton h-48" aria-busy="true" />}>
      <StartForm />
    </Suspense>
  );
}
