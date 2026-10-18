'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CallBuyer } from '@/components/CallBuyer';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MessageThread } from '@/components/MessageThread';
import { PincodeCheck, type PincodeStatus, type PincodeView } from '@/components/PincodeCheck';
import { useToast } from '@/components/Toaster';
import { Button, Page, RiskBadge, Section, Skeleton } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { inr } from '@/lib/format';
import { invalidateShop, qk, useOrder } from '@/lib/queries';
import type { OrderDetail } from '@/lib/types';

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || '';
  const toast = useToast();
  const client = useQueryClient();
  const orderQuery = useOrder(id);
  const order = orderQuery.data ?? null;
  const [pinState, setPinState] = useState<{ status: PincodeStatus; view?: PincodeView } | null>(null);
  const [saving, setSaving] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [callOpen, setCallOpen] = useState(false);

  async function mark(value: 'confirmed' | 'cancelled') {
    if (!order || order.stage === 'closed' || saving) return;
    const previous = order;
    setSaving(value);
    client.setQueryData<OrderDetail>(qk.order(order.id), { ...order, stage: 'closed', outcome: value });
    try {
      const next = await api<OrderDetail>(`/orders/${order.id}/outcome`, {
        method: 'PATCH',
        body: JSON.stringify({ outcome: value }),
      });
      client.setQueryData(qk.order(order.id), next);
      invalidateShop(client);
    } catch (err) {
      client.setQueryData(qk.order(order.id), previous);
      toast.error(err instanceof ApiError ? err.message : 'Could not save the outcome');
    } finally {
      setSaving('');
    }
  }

  async function useReply() {
    if (!order || saving) return;
    setSaving('address');
    try {
      const next = await api<OrderDetail>(`/orders/${order.id}/address`, {
        method: 'POST',
        body: JSON.stringify({ source: 'reply', useReply: true }),
      });
      client.setQueryData(qk.order(order.id), next);
      invalidateShop(client);
      toast.success('Address saved.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not use this reply');
    } finally {
      setSaving('');
    }
  }

  async function pin() {
    if (!order) return;
    setPinState({ status: 'loading' });
    try {
      const body = await api<PincodeView>(`/pincode/${order.pincode}`);
      setPinState({ status: 'ready', view: body });
      const place = body.locality || body.region || 'area on file';
      toast.info(`${order.pincode}: ${place}. Context only, not a ban.`);
    } catch (err) {
      setPinState({ status: 'error' });
      toast.error(err instanceof ApiError ? err.message : 'Could not check this pincode');
    }
  }

  if (orderQuery.isError && !order) {
    return (
      <Page eyebrow="/ Orders" title="Order">
        <p className="text-sm text-ink/70">This order did not open.</p>
      </Page>
    );
  }
  if (!order) {
    return (
      <Page eyebrow="/ Orders" title="Order">
        <div className="max-w-3xl space-y-4" aria-busy="true" aria-label="Opening the order">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-16" />
          <Skeleton className="h-40" />
        </div>
      </Page>
    );
  }

  const closed = order.stage === 'closed';
  const stopped = exceptionLabel(order);

  return (
    <Page
      eyebrow={`/ Orders · ${order.externalOrderId}`}
      title={order.buyerName}
      sub={`${inr(order.orderValue)} · ${order.paymentType === 'cod' ? 'COD' : 'Prepaid'} · ${order.phoneMasked} · ${order.city} ${order.pincode}`}
      actions={
        <>
          <RiskBadge band={order.riskBand} />
          <span className="font-display text-4xl font-black tabular-nums leading-none">{order.riskScore ?? '—'}</span>
        </>
      }
    >
      <Link href="/app/queue" className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] underline decoration-lime decoration-2 underline-offset-4">
        ← Exceptions
      </Link>

      <Section eyebrow={stopped || 'Running'} title={closed ? `Closed as ${order.outcome}` : 'This order'}>
        <p className="text-[15px] leading-7">{order.interventionWhy || 'Autopilot is handling this order.'}</p>
        {order.exception === 'address' ? (
          <div className="mt-4 border-2 border-ink bg-hl/40 p-4">
            <p className="eyebrow">Buyer reply</p>
            <p className="mt-2 text-[15px] leading-7">{order.addressReply || 'The reply is stored on the order.'}</p>
            <Button type="button" className="mt-4" disabled={Boolean(saving)} onClick={() => { void useReply(); }}>
              {saving === 'address' ? 'Saving…' : 'Use this'}
            </Button>
          </div>
        ) : null}
        {closed ? null : (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" disabled={Boolean(saving)} onClick={() => { void mark('confirmed'); }}>Confirm</Button>
            <Button type="button" tone="danger" disabled={Boolean(saving)} onClick={() => setConfirmCancel(true)}>Cancel</Button>
            <Button type="button" tone="ghost" onClick={() => { void pin(); }}>Check pincode</Button>
            <Button type="button" tone="ghost" data-tour="call-buyer" onClick={() => setCallOpen(true)}>Call the buyer</Button>
          </div>
        )}
        {callOpen && !closed ? <div className="mt-4"><CallBuyer orderId={order.id} open onClose={() => setCallOpen(false)} /></div> : null}
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
        {pinState ? <div className="mt-4"><PincodeCheck status={pinState.status} view={pinState.view} /></div> : null}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <Section eyebrow="The score" title="Why it stopped">
          <ul className="flex flex-wrap gap-2" aria-label="Risk reasons">
            {order.reasons.length ? order.reasons.map((reason) => (
              <li key={reason} className="border-2 border-ink bg-hl px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em]">{reason}</li>
            )) : <li className="text-sm text-inksoft">Not scored yet.</li>}
          </ul>
          <p className="mt-3 border-t-2 border-dashed border-ink/20 pt-3 text-[15px] leading-7">{order.address}</p>
        </Section>

        <Section eyebrow="History" title="Timeline">
          <ol className="space-y-2.5">
            {(order.timeline || []).length ? (order.timeline || []).map((step) => (
              <li key={`${step.at}-${step.step}`} className="border-2 border-ink bg-paper px-4 py-3">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">{step.step.replaceAll('_', ' ')}</p>
                <p className="mt-1 text-sm leading-6">{step.detail}</p>
              </li>
            )) : <li className="text-sm text-inksoft">No steps yet.</li>}
          </ol>
        </Section>
      </div>

      <Section eyebrow="Thread" title="WhatsApp" pad={false}>
        <div className="mt-4 px-5 pb-5 sm:px-6 sm:pb-6">
          <MessageThread status={order.whatsappStatus} conversation={order.conversation} />
        </div>
      </Section>
    </Page>
  );
}

function exceptionLabel(order: OrderDetail) {
  if (order.exception === 'template_pending' || order.exceptionWhy === 'template pending') return 'template pending';
  if (order.whatsappStatus === 'failed' || order.exception === 'send') return 'not sent';
  if (order.exception === 'address') return 'address';
  if (order.exception === 'shopify') return 'shopify';
  if (order.exception === 'call' || order.callState === 'due') return 'call';
  if (order.intervention === 'hold_review') return 'hold';
  return '';
}
