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
  const [voiceId, setVoiceId] = useState('');
  const [voiceState, setVoiceState] = useState<'playing' | 'played' | ''>('');
  const [canSend, setCanSend] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);

  async function load() {
    const [queue, me, whatsapp] = await Promise.all([
      api<{ orders: OrderDetail[] }>('/queue'),
      api<{ user: PublicUser }>('/auth/me'),
      api<{ configured: boolean; demo: boolean }>('/whatsapp'),
    ]);
    setOrders(queue.orders);
    setLanguage(me.user.messageLanguage);
    setCanSend(whatsapp.configured || whatsapp.demo || Boolean(me.user.isDemo));
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

  async function send(ids: string[]) {
    if (!ids.length) return;
    setSending(true);
    setError('');
    try {
      const body = await api<{ sent: string[] }>('/whatsapp/send', { method: 'POST', body: JSON.stringify({ ids }) });
      const sent = new Set(body.sent);
      setOrders((current) => current.map((order) => (sent.has(order.id) ? { ...order, whatsappStatus: 'sent' } : order)));
      setPicked({});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'WhatsApp did not send');
    } finally {
      setSending(false);
    }
  }

  async function outcome(id: string, value: 'confirmed' | 'cancelled' | 'no_response') {
    setError('');
    const previous = orders;
    setOrders((current) => current.filter((order) => order.id !== id));
    try {
      await api(`/orders/${id}/outcome`, { method: 'PATCH', body: JSON.stringify({ outcome: value }) });
    } catch (err) {
      setOrders(previous);
      setError(err instanceof ApiError ? err.message : 'Could not save the outcome');
    }
  }

  async function voice(order: OrderDetail) {
    setError('');
    setVoiceId(order.id);
    setVoiceState('playing');
    try {
      const result = await api<{ audioBase64: string | null; mime: string | null; script: string; notice: string | null }>(
        `/orders/${order.id}/voice`,
        { method: 'POST' },
      );
      if (result.audioBase64 && result.mime) {
        const audio = new Audio(`data:${result.mime};base64,${result.audioBase64}`);
        await audio.play();
        setVoiceState('played');
      } else if (result.notice) {
        setVoiceState('');
        setError(`${result.notice} Script: ${result.script}`);
      } else {
        setVoiceState('played');
      }
    } catch (err) {
      setVoiceState('');
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
            Approve a message and it sends from your own WhatsApp number. Without WhatsApp connected, the wa.me link is the fallback. Confirmed and cancelled orders teach the next score.
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
        {canSend ? (
          <Button
            type="button"
            disabled={sending || !Object.values(picked).some(Boolean)}
            onClick={() => send(Object.entries(picked).filter(([, on]) => on).map(([id]) => id))}
          >
            {sending ? 'Sending…' : 'Approve & send selected'}
          </Button>
        ) : null}
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
                {canSend ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(picked[order.id])}
                      onChange={(event) => setPicked((current) => ({ ...current, [order.id]: event.target.checked }))}
                    />
                    Select
                  </label>
                ) : null}
                {canSend ? (
                  <Button
                    type="button"
                    onClick={() => send([order.id])}
                    disabled={sending || Boolean(order.whatsappStatus && order.whatsappStatus !== 'failed')}
                  >
                    {order.whatsappStatus ? `WhatsApp ${order.whatsappStatus}` : 'Approve & send'}
                  </Button>
                ) : null}
                {!canSend && waLink(order, textFor(order)) ? (
                  <a className="btn-go" href={waLink(order, textFor(order)) || '#'} target="_blank" rel="noreferrer">
                    Open WhatsApp
                  </a>
                ) : null}
                {!canSend && order.messages && waLink(order, order.messages.prepaid_nudge) ? (
                  <a className="btn btn-ghost" href={waLink(order, order.messages.prepaid_nudge) || '#'} target="_blank" rel="noreferrer">
                    Prepaid nudge
                  </a>
                ) : null}
                <Button type="button" tone="ghost" onClick={() => voice(order)} disabled={voiceId === order.id && voiceState === 'playing'}>
                  {voiceId === order.id && voiceState === 'playing' ? 'Playing…' : voiceId === order.id && voiceState === 'played' ? 'Played' : 'Play Hindi script'}
                </Button>
              </div>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {order.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-ink/80">{order.address}</p>
            <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-ink/20 bg-canvas p-3">
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
