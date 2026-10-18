'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Suspense, useEffect, useState } from 'react';
import { MessageThread } from '@/components/MessageThread';
import { useToast } from '@/components/Toaster';
import { Button, Flag, Skeleton } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { inr } from '@/lib/format';
import { invalidateShop, useQueue } from '@/lib/queries';
import type { OrderDetail } from '@/lib/types';

export default function QueuePage() {
  return (
    <Suspense fallback={<QueueSkeleton />}>
      <QueueScreen />
    </Suspense>
  );
}

function QueueSkeleton() {
  return (
    <div className="mx-auto w-full max-w-page space-y-4 px-4 py-8 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading exceptions">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-24" />
    </div>
  );
}

function QueueScreen() {
  const toast = useToast();
  const client = useQueryClient();
  const router = useRouter();
  const params = useSearchParams();
  const queue = useQueue('action');
  const orders = queue.data?.orders ?? [];
  const selectedId = params?.get('order') || orders[0]?.id || '';
  const selected = orders.find((order) => order.id === selectedId) || null;
  const [saving, setSaving] = useState('');

  useEffect(() => {
    if (queue.isError) toast.error(queue.error instanceof ApiError ? queue.error.message : 'Could not load exceptions');
  }, [queue.isError, queue.error, toast]);

  function open(id: string) {
    router.replace(`/app/queue?order=${id}`);
  }

  async function mark(order: OrderDetail, outcome: 'confirmed' | 'cancelled') {
    if (saving) return;
    setSaving(outcome);
    try {
      await api(`/orders/${order.id}/outcome`, { method: 'PATCH', body: JSON.stringify({ outcome }) });
      invalidateShop(client);
      toast.success(outcome === 'confirmed' ? 'Confirmed.' : 'Cancelled.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save');
    } finally {
      setSaving('');
    }
  }

  async function useReply(order: OrderDetail) {
    if (saving) return;
    setSaving('address');
    try {
      await api(`/orders/${order.id}/address`, {
        method: 'POST',
        body: JSON.stringify({ source: 'reply', useReply: true }),
      });
      invalidateShop(client);
      toast.success('Address saved.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not use this reply');
    } finally {
      setSaving('');
    }
  }

  const ready = queue.isSuccess || queue.isError;

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-page flex-col px-4 py-6 sm:px-6 lg:px-8" data-tour-ready={ready ? 'true' : 'false'}>
      <header className="pb-4">
        <p className="eyebrow">/ Exceptions</p>
        <h1 className="mt-2 font-display text-4xl font-black uppercase tracking-tight">Exceptions</h1>
        <p className="mt-2 max-w-xl text-[15px] leading-7 text-ink/75">Orders that stopped. Everything else is already moving.</p>
      </header>
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <ul className="space-y-2" data-tour="exceptions" aria-label="Exceptions">
          {orders.map((order) => (
            <li key={order.id}>
              <button
                type="button"
                onClick={() => open(order.id)}
                className={`w-full border-2 border-ink px-3 py-3 text-left shadow-[3px_3px_0_0_#1B1712] ${order.id === selected?.id ? 'bg-lime' : 'bg-paper'}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-bold">{order.externalOrderId}</span>
                  <Flag tone={order.exception === 'send' || order.whatsappStatus === 'failed' ? 'red' : 'banana'}>{exceptionLabel(order)}</Flag>
                </span>
                <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.08em] text-inksoft">
                  {order.buyerName} · {inr(order.orderValue)}
                </span>
              </button>
            </li>
          ))}
          {!orders.length && ready ? (
            <li className="border-2 border-ink bg-paper px-4 py-6 shadow-[3px_3px_0_0_#1B1712]">
              <p className="font-display text-xl font-black uppercase">The shop is running</p>
              <p className="mt-2 text-sm leading-6 text-ink/70">Nothing stopped. Autopilot is talking to buyers.</p>
            </li>
          ) : null}
        </ul>
        <article className="border-2 border-ink bg-paper p-4 shadow-[4px_4px_0_0_#1B1712] sm:p-5" data-tour="exception-order">
          {selected ? (
            <>
              <p className="eyebrow">{exceptionLabel(selected)}</p>
              <h2 className="mt-2 font-display text-2xl font-black uppercase">{selected.buyerName}</h2>
              <p className="mt-2 text-[15px] leading-7">{selected.exceptionWhy || selected.interventionWhy}</p>
              {selected.exception === 'address' ? (
                <div className="mt-4 border-2 border-ink bg-hl/50 p-3">
                  <p className="eyebrow">Reply</p>
                  <p className="mt-2 text-[15px] leading-7">{selected.addressReply || 'Reply stored.'}</p>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2" data-tour="exception-action">
                {selected.exception === 'address' ? (
                  <Button type="button" disabled={Boolean(saving)} onClick={() => { void useReply(selected); }}>
                    {saving === 'address' ? 'Saving…' : 'Use this'}
                  </Button>
                ) : null}
                <Button type="button" disabled={Boolean(saving) || selected.stage === 'closed'} onClick={() => { void mark(selected, 'confirmed'); }}>Confirm</Button>
                <Button type="button" tone="danger" disabled={Boolean(saving) || selected.stage === 'closed'} onClick={() => { void mark(selected, 'cancelled'); }}>Cancel</Button>
                <Link href={`/app/orders/${selected.id}`} className="btn-ghost !px-3 !py-2 !text-[11px]">Open</Link>
              </div>
              <ol className="mt-5 space-y-2">
                {(selected.timeline || []).slice(-4).map((step) => (
                  <li key={`${step.at}-${step.step}`} className="border-2 border-ink/30 px-3 py-2">
                    <p className="font-mono text-[11px] font-bold uppercase">{step.step.replaceAll('_', ' ')}</p>
                    <p className="text-sm leading-6">{step.detail}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-4">
                <MessageThread status={selected.whatsappStatus} conversation={selected.conversation} />
              </div>
            </>
          ) : (
            <>
              <p className="eyebrow">Inbox</p>
              <h2 className="mt-2 font-display text-2xl font-black uppercase">Nothing waiting</h2>
              <p className="mt-2 text-[15px] leading-7 text-ink/75">When an order stops, it lands here with the reply and the next action.</p>
              <div className="mt-4" data-tour="exception-action">
                <Button type="button" disabled>Confirm</Button>
              </div>
            </>
          )}
        </article>
      </div>
    </div>
  );
}

function exceptionLabel(order: OrderDetail) {
  if (order.exception === 'template_pending' || order.exceptionWhy === 'template pending') return 'template pending';
  if (order.whatsappStatus === 'failed' || order.exception === 'send') return 'not sent';
  if (order.exception === 'address') return 'address';
  if (order.exception === 'shopify') return 'shopify';
  if (order.exception === 'call' || order.callState === 'due') return 'call';
  if (order.intervention === 'hold_review') return 'hold';
  return 'stopped';
}
