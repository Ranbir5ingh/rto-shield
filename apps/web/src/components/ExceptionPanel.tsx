'use client';

import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { MessageThread } from '@/components/MessageThread';
import { useToast } from '@/components/Toaster';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button, Flag } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { inr } from '@/lib/format';
import { invalidateShop } from '@/lib/queries';
import type { OrderDetail } from '@/lib/types';

export function exceptionLabel(order: OrderDetail) {
  if (order.exception === 'template_pending' || order.exceptionWhy === 'template pending') return 'template pending';
  if (order.whatsappStatus === 'failed' || order.exception === 'send') return 'not sent';
  if (order.exception === 'address') return 'address';
  if (order.exception === 'shopify') return 'shopify';
  if (order.exception === 'call' || order.callState === 'due') return 'call';
  if (order.intervention === 'hold_review') return 'hold';
  return 'stopped';
}

export function ExceptionRow({
  order,
  selected,
  onSelect,
}: {
  order: OrderDetail;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const tone = order.exception === 'send' || order.whatsappStatus === 'failed' ? 'red' : 'banana';
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-bold">{order.externalOrderId}</span>
        <Flag tone={tone}>{exceptionLabel(order)}</Flag>
      </span>
      <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.08em] text-inksoft">
        {order.buyerName} · {inr(order.orderValue)}
      </span>
    </>
  );
  const className = `w-full border-2 border-ink px-3 py-3 text-left shadow-[3px_3px_0_0_#1B1712] ${selected ? 'bg-lime' : 'bg-paper'}`;
  return (
    <li>
      <Link href={`/app/queue/${order.id}`} className={`${className} block lg:hidden`}>
        {body}
      </Link>
      <button type="button" onClick={() => onSelect(order.id)} className={`${className} hidden lg:block`}>
        {body}
      </button>
    </li>
  );
}

export function ExceptionPanel({ order }: { order: OrderDetail | null }) {
  const toast = useToast();
  const client = useQueryClient();
  const [saving, setSaving] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function mark(outcome: 'confirmed' | 'cancelled') {
    if (!order || saving) return;
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

  async function useReply() {
    if (!order || saving) return;
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

  return (
    <article className="border-2 border-ink bg-paper p-4 shadow-[4px_4px_0_0_#1B1712] sm:p-5" data-tour="exception-order">
      {order ? (
        <>
          <p className="eyebrow">{exceptionLabel(order)}</p>
          <h2 className="mt-2 break-words font-display text-2xl font-black uppercase">{order.buyerName}</h2>
          <p className="mt-2 text-[15px] leading-7">{order.exceptionWhy || order.interventionWhy}</p>
          {order.exception === 'address' ? (
            <div className="mt-4 border-2 border-ink bg-hl/50 p-3">
              <p className="eyebrow">Reply</p>
              <p className="mt-2 text-[15px] leading-7">{order.addressReply || 'Reply stored.'}</p>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2" data-tour="exception-action">
            {order.exception === 'address' ? (
              <Button type="button" disabled={Boolean(saving)} onClick={() => { void useReply(); }}>
                {saving === 'address' ? 'Saving…' : 'Use this'}
              </Button>
            ) : null}
            <Button type="button" disabled={Boolean(saving) || order.stage === 'closed'} onClick={() => { void mark('confirmed'); }}>Confirm</Button>
            <Button type="button" tone="danger" disabled={Boolean(saving) || order.stage === 'closed'} onClick={() => setConfirmCancel(true)}>Cancel</Button>
            <Link href={`/app/orders/${order.id}`} className="btn-ghost !px-3 !py-2 !text-[11px]">Open</Link>
          </div>
          <ol className="mt-5 space-y-2">
            {(order.timeline || []).slice(-4).map((step) => (
              <li key={`${step.at}-${step.step}`} className="border-2 border-ink/30 px-3 py-2">
                <p className="font-mono text-[11px] font-bold uppercase">{step.step.replaceAll('_', ' ')}</p>
                <p className="text-sm leading-6">{step.detail}</p>
              </li>
            ))}
          </ol>
          <div className="mt-4">
            <MessageThread status={order.whatsappStatus} conversation={order.conversation} />
          </div>
          <ConfirmDialog
            open={confirmCancel}
            title="Cancel this order"
            body="The order closes as cancelled. Autopilot will not message the buyer again."
            confirmLabel="Cancel order"
            onClose={() => setConfirmCancel(false)}
            onConfirm={() => {
              setConfirmCancel(false);
              void mark('cancelled');
            }}
          />
        </>
      ) : (
        <>
          <p className="eyebrow">Inbox</p>
          <h2 className="mt-2 font-display text-2xl font-black uppercase">Nothing waiting</h2>
          <p className="mt-2 text-[15px] leading-7 text-ink/75">When an order stops, it lands here with the reply and the next action.</p>
          <div className="mt-4" data-tour="exception-action">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-inksoft">Confirm, cancel, or use a reply when an order stops.</p>
          </div>
        </>
      )}
    </article>
  );
}
