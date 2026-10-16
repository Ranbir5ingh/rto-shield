'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, CopyButton, Notice, RiskBadge, Skeleton, Dropdown } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { inr } from '@/lib/format';
import type { OrderDetail, PublicUser } from '@/lib/types';

export default function QueuePage() {
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [language, setLanguage] = useState<PublicUser['messageLanguage']>('hinglish');
  const [error, setError] = useState('');
  const [pincodeNote, setPincodeNote] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  async function load() {
    const [queue, me] = await Promise.all([
      api<{ orders: OrderDetail[] }>('/queue'),
      api<{ user: PublicUser }>('/auth/me'),
    ]);
    setOrders(queue.orders);
    setLanguage(me.user.messageLanguage);
  }

  useEffect(() => {
    load()
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load the queue'))
      .finally(() => setReady(true));
  }, []);

  function textFor(order: OrderDetail) {
    if (!order.messages) return '';
    if (language === 'hindi') return order.messages.hindi;
    if (language === 'english') return order.messages.english;
    return order.messages.hinglish;
  }

  function waLink(order: OrderDetail, text: string) {
    if (!order.waUrl || !text) return null;
    const number = order.waUrl.split('?')[0];
    return `${number}?text=${encodeURIComponent(text)}`;
  }

  async function outcome(id: string, value: 'confirmed' | 'cancelled' | 'no_response') {
    setError('');
    try {
      await api(`/orders/${id}/outcome`, { method: 'PATCH', body: JSON.stringify({ outcome: value }) });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the outcome');
    }
  }

  async function voice(order: OrderDetail) {
    setError('');
    try {
      const result = await api<{ audioBase64: string | null; mime: string | null; script: string; notice: string | null }>(
        `/orders/${order.id}/voice`,
        { method: 'POST' },
      );
      if (result.audioBase64 && result.mime) {
        const audio = new Audio(`data:${result.mime};base64,${result.audioBase64}`);
        await audio.play();
      } else if (result.notice) {
        setError(`${result.notice} Script: ${result.script}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Voice failed');
    }
  }

  async function pin(order: OrderDetail) {
    const body = await api<{ locality: string | null; region: string | null; notice: string | null; fairness: string; snippets: Array<{ title: string }> }>(
      `/pincode/${order.pincode}`,
    );
    const snippets = body.snippets.map((item) => item.title).filter(Boolean).join(' · ');
    setPincodeNote((current) => ({
      ...current,
      [order.id]: [body.locality || body.region, body.notice, snippets, body.fairness].filter(Boolean).join(' '),
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display font-medium text-display-2">Confirmation queue</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink/70">
            WhatsApp opens with the text filled in. RTO Shield does not send it. Mark what the buyer said — cancelled and confirmed orders teach the next score.
          </p>
        </div>
        <label className="text-sm">
          Message
          <Dropdown
            label="Message language"
            value={language}
            onChange={(v) => setLanguage(v as PublicUser['messageLanguage'])}
            options={[
              { value: 'hinglish', label: 'Hinglish' },
              { value: 'hindi', label: 'Hindi' },
              { value: 'english', label: 'English' },
            ]}
          />
        </label>
      </div>
      {error ? <Notice>{error}</Notice> : null}
      {!ready ? <Skeleton className="h-40" /> : null}
      {ready && !orders.length ? <p className="text-sm text-ink/60">No medium or high risk orders. Score a batch, or ship the low-risk ones.</p> : null}
      <div className="space-y-4">
        {orders.map((order) => (
          <article key={order.id} className="panel p-5 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">
                    <Link href={`/app/orders/${order.id}`} className="hover:underline">
                      {order.buyerName}
                    </Link>
                  </h2>
                  <RiskBadge band={order.riskBand} />
                  <span className="text-sm tabular-nums">{order.riskScore}</span>
                </div>
                <p className="text-sm text-ink/60">
                  {order.externalOrderId} · {inr(order.orderValue)} · {order.paymentType.toUpperCase()} · {order.phoneMasked} · {order.city} {order.pincode}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {waLink(order, textFor(order)) ? (
                  <a className="btn-go" href={waLink(order, textFor(order)) || '#'} target="_blank" rel="noreferrer">
                    Open WhatsApp
                  </a>
                ) : null}
                {order.messages && waLink(order, order.messages.prepaid_nudge) ? (
                  <a className="btn btn-ghost" href={waLink(order, order.messages.prepaid_nudge) || '#'} target="_blank" rel="noreferrer">
                    Prepaid nudge
                  </a>
                ) : null}
                <Button type="button" tone="ghost" onClick={() => voice(order)}>
                  Play Hindi script
                </Button>
              </div>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {order.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-ink/80">{order.address}</p>
            <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-line bg-canvas p-3">
              <p className="font-hindi text-sm leading-6">{textFor(order)}</p>
              {textFor(order) ? <CopyButton text={textFor(order)} /> : null}
            </div>
            {order.messages ? (
              <p className="mt-2 text-sm text-ink/70">
                Prepaid nudge: {order.messages.prepaid_nudge}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={() => outcome(order.id, 'confirmed')}>
                Confirmed
              </Button>
              <Button type="button" tone="danger" onClick={() => outcome(order.id, 'cancelled')}>
                Cancelled
              </Button>
              <Button type="button" tone="ghost" onClick={() => outcome(order.id, 'no_response')}>
                No response
              </Button>
              <Button type="button" tone="ghost" onClick={() => pin(order)}>
                Pincode context
              </Button>
            </div>
            {pincodeNote[order.id] ? <p className="mt-3 text-xs leading-5 text-ink/70">{pincodeNote[order.id]}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
