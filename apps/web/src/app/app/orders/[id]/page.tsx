'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Notice, RiskBadge, Skeleton } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { inr, predictorLabel } from '@/lib/format';
import type { OrderDetail } from '@/lib/types';

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || '';
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!id) return;
    api<OrderDetail>(`/orders/${id}`)
      .then(setOrder)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not open the order'));
  }, [id]);

  async function voice() {
    if (!order) return;
    setError('');
    try {
      const result = await api<{ audioBase64: string | null; mime: string | null; script: string; notice: string | null }>(
        `/orders/${order.id}/voice`,
        { method: 'POST' },
      );
      if (result.audioBase64 && result.mime) {
        await new Audio(`data:${result.mime};base64,${result.audioBase64}`).play();
      } else if (result.notice) {
        setNote(`${result.notice} ${result.script}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Voice failed');
    }
  }

  async function pin() {
    if (!order) return;
    const body = await api<{ locality: string | null; region: string | null; notice: string | null; fairness: string }>(
      `/pincode/${order.pincode}`,
    );
    setNote([body.locality || body.region, body.notice, body.fairness].filter(Boolean).join(' '));
  }

  if (error && !order) return <Notice>{error}</Notice>;
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

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/app/queue" className="text-sm font-medium underline">
        ← Queue
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-ink/50">{order.externalOrderId}</p>
          <h1 className="font-display text-display-2">{order.buyerName}</h1>
          <p className="mt-1 text-sm text-ink/60">
            {inr(order.orderValue)} · {order.paymentType.toUpperCase()} · {order.phoneMasked} · {order.city} {order.pincode}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RiskBadge band={order.riskBand} />
          <span className="font-display text-3xl tabular-nums">{order.riskScore ?? '—'}</span>
        </div>
      </div>
      {error ? <Notice>{error}</Notice> : null}
      <article className="panel p-5">
        <h2 className="font-semibold">Why this score</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {order.reasons.length ? order.reasons.map((reason) => <li key={reason}>{reason}</li>) : <li>Not scored yet.</li>}
        </ul>
        {order.addressQuality ? (
          <p className="mt-3 text-sm text-ink/70">
            Address notes from {order.addressQuality.source}. Quality {order.addressQuality.quality_score}.
            {order.model ? ` Predictor: ${predictorLabel(order.model)}.` : ''}
          </p>
        ) : null}
        <p className="mt-3 text-sm leading-6">{order.address}</p>
      </article>
      {order.messages ? (
        <article className="panel p-5">
          <h2 className="font-semibold">Confirmation</h2>
          <p className="mt-3 font-hindi text-sm leading-6">{text}</p>
          <p className="mt-2 text-sm text-ink/70">Prepaid nudge: {order.messages.prepaid_nudge}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {wa ? (
              <a className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white" href={wa} target="_blank" rel="noreferrer">
                Open WhatsApp
              </a>
            ) : null}
            <Button type="button" tone="ghost" onClick={voice}>
              Play Hindi script
            </Button>
            <Button type="button" tone="ghost" onClick={pin}>
              Pincode context
            </Button>
          </div>
          {note ? <p className="mt-3 text-xs leading-5 text-ink/70">{note}</p> : null}
        </article>
      ) : null}
    </div>
  );
}
