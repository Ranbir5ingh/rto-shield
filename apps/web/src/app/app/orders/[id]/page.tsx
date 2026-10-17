'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { MessageThread } from '@/components/MessageThread';
import { useToast } from '@/components/Toaster';
import { Button, CopyButton, RiskBadge, Skeleton } from '@/components/ui';
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

  async function pin() {
    if (!order) return;
    const body = await api<{ locality: string | null; region: string | null; notice: string | null; fairness: string }>(
      `/pincode/${order.pincode}`,
    );
    setNote([body.locality || body.region, body.notice, body.fairness].filter(Boolean).join(' '));
  }

  if (orderQuery.isError && !order) return <p className="text-sm text-ink/70">This order did not open.</p>;
  if (!order) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" aria-busy="true" aria-label="Opening the order">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-16" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const text = order.messages?.hinglish || '';
  const wa = order.waUrl && text ? `${order.waUrl.split('?')[0]}?text=${encodeURIComponent(text)}` : null;
  const closed = order.stage === 'closed';

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/app/queue" className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] underline decoration-lime decoration-2 underline-offset-4">
        ← Queue
      </Link>
      <div className="grid gap-4 border-2 border-ink bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-inksoft">{order.externalOrderId}</p>
          <h1 className="font-display text-display-2">{order.buyerName}</h1>
          <p className="mt-2 font-mono text-[12px] font-bold uppercase tracking-[0.12em]">
            {inr(order.orderValue)} · {order.paymentType === 'cod' ? 'COD' : 'Prepaid'} · {order.phoneMasked}
          </p>
          <p className="mt-1 text-sm text-ink/70">{order.city} {order.pincode}</p>
        </div>
        <div className="flex items-center gap-3">
          <RiskBadge band={order.riskBand} />
          <span className="font-display text-5xl font-black tabular-nums leading-none">{order.riskScore ?? '—'}</span>
        </div>
      </div>
      <article className="border-2 border-ink bg-white p-4">
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]">Why this score</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {order.reasons.length ? order.reasons.map((reason) => (
            <li key={reason} className="border-2 border-ink bg-hl px-2 py-1 text-sm">{reason}</li>
          )) : <li className="text-sm text-inksoft">Not scored yet.</li>}
        </ul>
        {order.addressQuality ? (
          <p className="mt-3 text-sm text-ink/70">
            Address notes from {order.addressQuality.source}. Quality {order.addressQuality.quality_score}.
            {order.model ? ` Predictor: ${predictorLabel(order.model)}.` : ''}
          </p>
        ) : null}
        <p className="mt-3 text-sm leading-6">{order.address}</p>
      </article>
      <MessageThread status={order.whatsappStatus} conversation={order.conversation} />
      {order.messages ? (
        <article className="border-2 border-ink bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]">Draft</h2>
              <p className="mt-2 font-hindi text-sm leading-6">{text}</p>
            </div>
            {text ? <CopyButton text={text} /> : null}
          </div>
          <p className="mt-3 text-sm text-ink/70">Prepaid nudge: {order.messages.prepaid_nudge}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {wa ? (
              <a className="btn-go" href={wa} target="_blank" rel="noreferrer">
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
          {note ? <p className="mt-3 text-xs leading-5 text-ink/70">{note}</p> : null}
        </article>
      ) : null}
      <div className="sticky bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-30 flex flex-wrap gap-2 border-2 border-ink bg-paper p-3 shadow-sticker">
        <Button type="button" onClick={() => mark('confirmed')} disabled={closed || Boolean(saving)}>
          {saving === 'confirmed' ? 'Saving…' : 'Confirmed'}
        </Button>
        <Button type="button" tone="danger" onClick={() => mark('cancelled')} disabled={closed || Boolean(saving)}>
          {saving === 'cancelled' ? 'Saving…' : 'Cancelled'}
        </Button>
        <Button type="button" tone="ghost" onClick={() => mark('no_response')} disabled={closed || Boolean(saving)}>
          Skip
        </Button>
        {closed ? <p className="self-center font-mono text-[11px] font-bold uppercase tracking-[0.14em]">Closed as {order.outcome}</p> : null}
      </div>
    </div>
  );
}
