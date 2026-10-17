'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CallBuyer } from '@/components/CallBuyer';
import { MessageThread } from '@/components/MessageThread';
import { OrderActions } from '@/components/OrderActions';
import { useToast } from '@/components/Toaster';
import { Button, CopyButton, Page, RiskBadge, Section, Skeleton } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { inr, predictorLabel } from '@/lib/format';
import { invalidateShop, qk, useOrder } from '@/lib/queries';
import type { OrderDetail } from '@/lib/types';

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || '';
  const toast = useToast();
  const client = useQueryClient();
  const orderQuery = useOrder(id);
  const order = orderQuery.data ?? null;
  const [note, setNote] = useState('');
  const [voiceState, setVoiceState] = useState<'idle' | 'playing' | 'played'>('idle');
  const [saving, setSaving] = useState('');
  const [calling, setCalling] = useState(false);
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');

  async function voice() {
    if (!order) return;
    setVoiceState('playing');
    try {
      const result = await api<{ audioBase64: string | null; mime: string | null; script: string; notice: string | null }>(
        `/orders/${order.id}/voice`,
        { method: 'POST' },
      );
      if (result.audioBase64 && result.mime) {
        await new Audio(`data:${result.mime};base64,${result.audioBase64}`).play();
        setVoiceState('played');
      } else if (result.notice) {
        setVoiceState('idle');
        setNote(`${result.notice} ${result.script}`);
      } else {
        setVoiceState('played');
      }
    } catch (err) {
      setVoiceState('idle');
      toast.error(err instanceof ApiError ? err.message : 'Voice failed');
    }
  }

  async function mark(value: 'confirmed' | 'cancelled' | 'no_response') {
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

  async function prepaid() {
    if (!order) return;
    setSaving('prepaid');
    try {
      const next = await api<OrderDetail & { notice?: string | null }>(`/orders/${order.id}/prepaid`, { method: 'POST' });
      client.setQueryData(qk.order(order.id), next);
      invalidateShop(client);
      toast.success(next.notice || 'Prepaid checkout is ready.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create the prepaid link');
    } finally {
      setSaving('');
    }
  }

  async function saveAddress(event: React.FormEvent) {
    event.preventDefault();
    if (!order || !address.trim()) return;
    setSaving('address');
    try {
      const next = await api<OrderDetail>(`/orders/${order.id}/address`, {
        method: 'POST',
        body: JSON.stringify({ address, landmark, source: 'seller' }),
      });
      client.setQueryData(qk.order(order.id), next);
      setAddress('');
      setLandmark('');
      toast.success('Address updated.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update the address');
    } finally {
      setSaving('');
    }
  }

  async function pin() {
    if (!order) return;
    const body = await api<{ locality: string | null; region: string | null; notice: string | null; fairness: string }>(
      `/pincode/${order.pincode}`,
    );
    setNote([body.locality || body.region, body.notice, body.fairness].filter(Boolean).join(' '));
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

  const text = order.messages?.hinglish || '';
  const wa = order.waUrl && text ? `${order.waUrl.split('?')[0]}?text=${encodeURIComponent(text)}` : null;
  const closed = order.stage === 'closed';

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
        ← Back to queue
      </Link>

      <Section eyebrow="Next action" title="Decide">
        <OrderActions
          order={order}
          busy={Boolean(saving)}
          canSend
          onPrimary={() => {
            if (order.intervention === 'offer_prepaid') void prepaid();
            else if (order.intervention === 'request_address') document.getElementById('address')?.focus();
            else void mark('confirmed');
          }}
          onOutcome={(value) => mark(value)}
          onPrepaid={() => prepaid()}
          onCall={() => setCalling(true)}
          onVoice={() => voice()}
          onPin={() => pin()}
        />
        {calling ? <div className="mt-4"><CallBuyer orderId={order.id} open onClose={() => setCalling(false)} /></div> : null}
        {closed ? <p className="mt-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-inksoft">Closed as {order.outcome}</p> : null}
      </Section>

      {order.prepaid?.invoiceUrl ? (
        <div className="border-2 border-ink bg-lime/40 p-5 shadow-sticker-sm sm:p-6">
          <p className="eyebrow">Prepaid {order.prepaid.status}</p>
          <p className="mt-2 text-[15px] leading-7">{order.prepaid.discountPct}% off. Unpaid drafts expire and the cash on delivery order stays.</p>
          <a className="btn-go mt-4 inline-flex !px-5 !py-3 !text-[11px]" href={order.prepaid.invoiceUrl} target="_blank" rel="noreferrer">Open checkout</a>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <Section eyebrow="The score" title="Why this score">
          <ul className="flex flex-wrap gap-2">
            {order.reasons.length ? order.reasons.map((reason) => (
              <li key={reason} className="border-2 border-ink bg-hl px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em]">{reason}</li>
            )) : <li className="text-sm text-inksoft">Not scored yet.</li>}
          </ul>
          {order.addressQuality ? (
            <p className="mt-4 text-sm leading-6 text-ink/70">
              Address notes from {order.addressQuality.source}. Quality {order.addressQuality.quality_score}.
              {order.model ? ` Predictor: ${predictorLabel(order.model)}.` : ''}
            </p>
          ) : null}
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

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <Section eyebrow="Fix it" title="Update address">
          <form onSubmit={saveAddress} className="space-y-4">
            <div>
              <label htmlFor="address" className="eyebrow text-inksoft">Address</label>
              <input id="address" className="input-paper mt-2" value={address} onChange={(event) => setAddress(event.target.value)} />
            </div>
            <div>
              <label htmlFor="landmark" className="eyebrow text-inksoft">Landmark</label>
              <input id="landmark" className="input-paper mt-2" value={landmark} onChange={(event) => setLandmark(event.target.value)} />
            </div>
            <Button type="submit" disabled={saving === 'address'}>Save address</Button>
          </form>
        </Section>

        {order.messages ? (
          <Section eyebrow="Outreach" title="Message draft" action={text ? <CopyButton text={text} /> : null}>
            <p className="font-hindi text-[15px] leading-7">{text}</p>
            <p className="mt-3 border-t-2 border-dashed border-ink/20 pt-3 text-sm leading-6 text-ink/70">Prepaid nudge: {order.messages.prepaid_nudge}</p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {wa ? (
                <a className="btn-go !px-5 !py-3 !text-[11px]" href={wa} target="_blank" rel="noreferrer">
                  Open WhatsApp
                </a>
              ) : null}
              <Button type="button" tone="ghost" onClick={voice} disabled={voiceState === 'playing'}>
                {voiceState === 'playing' ? 'Playing…' : voiceState === 'played' ? 'Played' : 'Play Hindi script'}
              </Button>
              <Button type="button" tone="ghost" onClick={pin}>
                Pincode context
              </Button>
            </div>
            {note ? <p className="mt-3 text-sm leading-6 text-ink/70">{note}</p> : null}
          </Section>
        ) : null}
      </div>

      <Section eyebrow="Thread" title="WhatsApp conversation" pad={false}>
        <div className="mt-4 px-5 pb-5 sm:px-6 sm:pb-6">
          <MessageThread status={order.whatsappStatus} conversation={order.conversation} />
        </div>
      </Section>
    </Page>
  );
}
