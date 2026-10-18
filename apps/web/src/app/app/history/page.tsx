'use client';

import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { CsvImporter } from '@/components/CsvImporter';
import { useToast } from '@/components/Toaster';
import { Button, Page, Pager, Section, Skeleton } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { inr } from '@/lib/format';
import { invalidateShop, useMe, useOrders, useShopify } from '@/lib/queries';

const PAGE_SIZE = 12;
const OUTCOMES = [
  ['', 'All'],
  ['delivered', 'Delivered'],
  ['rto', 'RTO'],
  ['cancelled', 'Cancelled'],
] as const;

export default function HistoryPage() {
  const toast = useToast();
  const client = useQueryClient();
  const me = useMe();
  const shopify = useShopify();
  const [pending, setPending] = useState(false);
  const [page, setPage] = useState(0);
  const [outcome, setOutcome] = useState('');
  const [q, setQ] = useState('');
  const [needle, setNeedle] = useState('');
  const list = useOrders('history', page * PAGE_SIZE, PAGE_SIZE, { outcome, q: needle });
  const orders = list.data?.orders ?? [];
  const total = list.data?.total ?? 0;
  const liveShop = Boolean(shopify.data?.connected && !shopify.data.demo && shopify.data.shop);
  const demoVisitor = me.data?.role === 'demo';

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNeedle(q.trim());
      setPage(0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    if (list.isError && !list.data) toast.error(list.error instanceof ApiError ? list.error.message : 'Could not load history');
  }, [list.isError, list.data, list.error, toast]);

  async function sample() {
    setPending(true);
    try {
      const result = await api<{ history: number; pending: number; notice: string }>('/orders/sample', { method: 'POST' });
      toast.success(`Loaded ${result.history} historical orders and ${result.pending} pending ones. ${result.notice}`);
      invalidateShop(client);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not build sample data');
    } finally {
      setPending(false);
    }
  }

  return (
    <Page
      eyebrow="/ Training data"
      title="Order history"
      sub="Delivered, RTO, and cancelled orders teach the model. Confirmed in the app is a decision, not a training label. Sample buyers are synthetic."
      actions={
        <>
          {liveShop || demoVisitor ? null : (
            <Button type="button" onClick={sample} disabled={pending}>
              {pending ? 'Building sample…' : 'Try with sample data'}
            </Button>
          )}
          <a className="btn-ghost !px-5 !py-3 !text-[11px]" href="/samples/generic-template.csv">
            Download template
          </a>
        </>
      }
    >
      <Section eyebrow={`History · ${total}`} title="What already happened" pad={false}>
        <div className="mt-4 flex flex-col gap-3 border-t-2 border-ink px-5 py-4 sm:px-6" data-tour="history-list">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Outcome">
            {OUTCOMES.map(([value, label]) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={outcome === value}
                className={`border-2 border-ink px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${
                  outcome === value ? 'bg-lime shadow-sticker-sm' : 'bg-white hover:bg-hl/40'
                }`}
                onClick={() => {
                  setOutcome(value);
                  setPage(0);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="eyebrow text-inksoft">Search</span>
            <input
              className="input-paper mt-2"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Order id, city, or pincode"
              aria-label="Search history"
            />
          </label>
        </div>
        <div className={list.isFetching && !list.isLoading ? 'opacity-80' : ''}>
          {list.isLoading ? <div className="px-5 pb-5 sm:px-6"><Skeleton className="h-48" /></div> : null}
          {orders.map((order) => (
            <article key={order.id} className="grid gap-3 border-t-2 border-ink/60 px-5 py-4 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center sm:px-6">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
                {order.outcome || 'Open'}
              </p>
              <div className="min-w-0">
                <Link href={`/app/orders/${order.id}`} className="font-display text-lg font-extrabold uppercase tracking-tight underline decoration-lime decoration-2 underline-offset-4">
                  {order.externalOrderId}
                </Link>
                <p className="mt-1 text-sm text-ink/75">
                  {order.buyerName} · {order.city || '—'} · {order.pincode}
                </p>
                <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-inksoft">
                  {inr(order.orderValue)} · {order.paymentType === 'cod' ? 'COD' : 'Prepaid'} · {order.productName || 'Order'}
                </p>
              </div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-inksoft sm:text-right">
                {order.orderedAt ? order.orderedAt.slice(0, 10) : ''}
              </p>
            </article>
          ))}
          {list.isFetched && !orders.length ? (
            <div className="border-t-2 border-ink px-5 py-10 text-center sm:px-6">
              <p className="font-mono text-xs font-bold uppercase leading-6 tracking-[0.16em] text-inksoft">
                {needle || outcome ? 'Nothing matches that filter.' : 'No delivered, RTO, or cancelled orders yet.'}
              </p>
            </div>
          ) : null}
        </div>
        <div className="border-t-2 border-ink px-5 py-3 sm:px-6">
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </div>
      </Section>

      {demoVisitor ? null : (
        <Section eyebrow="Upload" title="Import a CSV">
          <CsvImporter mode="history" onImported={() => invalidateShop(client)} />
        </Section>
      )}
    </Page>
  );
}
