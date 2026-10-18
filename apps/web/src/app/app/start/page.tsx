'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useToast } from '@/components/Toaster';
import { WhatsAppSetupGuide } from '@/components/WhatsAppGuide';
import { Button, Field, Flag, Notice, Page, Section, inputClass } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { invalidateShop, useShopify, useWhatsapp } from '@/lib/queries';
import { useQueryClient } from '@tanstack/react-query';

function StartForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [shop, setShop] = useState('');
  const [pending, setPending] = useState(false);
  const [samplePending, setSamplePending] = useState(false);
  const toast = useToast();
  const client = useQueryClient();
  const shopify = useShopify();
  const whatsappQuery = useWhatsapp();
  const link = shopify.data ?? null;
  const whatsapp = whatsappQuery.data ?? null;

  useEffect(() => {
    if (params?.get('shopify') === 'error') toast.error('Shopify did not finish the install. Start again from the shop domain.');
  }, [params, toast]);

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
      invalidateShop(client);
      router.push('/app');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not prepare the sample shop');
      setSamplePending(false);
    }
  }

  const progress = link?.backfill.total ? Math.round((link.backfill.processed / link.backfill.total) * 100) : link?.backfill.status === 'done' ? 100 : 0;

  if (!shopify.isFetched) {
    return (
      <Page eyebrow="/ Setup" title="Connect the shop">
        <div className="skeleton h-48" aria-busy="true" data-tour-ready="false" />
      </Page>
    );
  }

  return (
    <Page
      eyebrow="/ Setup"
      title="Connect the shop"
      sub="Shopify pulls the last 180 days and keeps scoring new orders. A CSV is still there if you want it. Phones stay encrypted."
    >
      <div data-tour-ready="true" className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <Section
          eyebrow="Step 1 · Orders in"
          title="Shopify"
          action={<Flag tone={link?.connected ? 'go' : 'ghost'}>{link?.connected ? 'Connected' : 'Not connected'}</Flag>}
        >
          {link?.connected ? (
            <div data-tour="shopify-connected">
              <p className="font-display text-xl font-extrabold uppercase tracking-tight">{link.demo ? 'Demo store' : link.shop}</p>
              <p className="mt-2 text-sm leading-6 text-ink/70">
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
              <div className="mt-4 h-3 border-2 border-ink bg-paper" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-lime transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-2 flex justify-between font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-inksoft">
                <span>Backfill</span>
                <span>{progress}%</span>
              </div>
              {link.backfill.status === 'done' ? (
                <Link href="/app" className="btn-go mt-5 inline-flex">
                  See the first scores
                </Link>
              ) : null}
            </div>
          ) : (
              <form onSubmit={connect} data-tour="shopify-connect" className="space-y-4">
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
        </Section>

        <Section
          eyebrow="Step 2 · Talk to buyers"
          title="WhatsApp"
          action={
            <WhatsAppSetupGuide
              callbackUrl={whatsapp?.callbackUrl || ''}
              canReveal={Boolean(whatsapp?.verifyTokenSet)}
              progress={whatsapp || {}}
            />
          }
        >
          <div data-tour="whatsapp-card">
            <p className="text-[15px] leading-7 text-ink/70">
              Optional. Messages go out from RTO Shield&apos;s number. A shop number is only for buyers who should see it.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Flag tone={whatsapp?.messaging === 'own' ? 'go' : 'ghost'}>{whatsapp?.messaging === 'own' ? 'Your own number' : 'RTO Shield (default)'}</Flag>
              {whatsapp?.templateStatus ? (
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-inksoft">
                  Template {whatsapp.templateStatus}
                </span>
              ) : null}
            </div>
            <Link href="/app/settings" className="btn-ghost mt-5 inline-flex">
              Open WhatsApp settings
            </Link>
          </div>
        </Section>
      </div>

      <Section eyebrow="No Shopify yet?" title="Other ways in">
        <div className="grid gap-4 sm:grid-cols-2" data-tour="import-alternatives">
          <div className="border-2 border-ink bg-paper p-5">
            <h3 className="font-display text-lg font-extrabold uppercase tracking-tight">CSV, if you must</h3>
            <p className="mt-2 text-sm leading-6 text-ink/70">A Shopify export, a Meesho-style file, or the generic template.</p>
            <Link href="/app/orders/import" className="btn-ghost mt-4 inline-flex !px-5 !py-3 !text-[11px]">
              Upload CSV
            </Link>
          </div>
          <div className="border-2 border-ink bg-paper p-5">
            <h3 className="font-display text-lg font-extrabold uppercase tracking-tight">Sample shop</h3>
            <p className="mt-2 text-sm leading-6 text-ink/70">Invented buyers, so you can see a score without a store.</p>
            <Button type="button" className="mt-4 !px-5 !py-3 !text-[11px]" tone="ghost" onClick={sample} disabled={samplePending}>
              {samplePending ? 'Scoring sample orders…' : 'Load and score'}
            </Button>
          </div>
        </div>
      </Section>
    </Page>
  );
}

export default function StartPage() {
  return (
    <Suspense fallback={<Page eyebrow="/ Setup" title="Connect the shop"><div className="skeleton h-48" aria-busy="true" /></Page>}>
      <StartForm />
    </Suspense>
  );
}
