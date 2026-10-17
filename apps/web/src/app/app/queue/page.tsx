'use client';

import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { CallBuyer } from '@/components/CallBuyer';
import { MessageThread } from '@/components/MessageThread';
import { actionCopy, OrderActions } from '@/components/OrderActions';
import { useToast } from '@/components/Toaster';
import { Button, CopyButton, Pager, RiskBadge, Skeleton, Dropdown } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { inr } from '@/lib/format';
import { invalidateShop, qk, useMe, useQueue, useWhatsapp } from '@/lib/queries';
import type { OrderDetail, PublicUser } from '@/lib/types';

const PAGE = 6;

export default function QueuePage() {
  const toast = useToast();
  const client = useQueryClient();
  const queue = useQueue();
  const me = useMe();
  const whatsapp = useWhatsapp();
  const orders = queue.data?.orders ?? [];
  const [language, setLanguage] = useState<PublicUser['messageLanguage']>('hinglish');
  const [pincodeNote, setPincodeNote] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const [band, setBand] = useState<'all' | 'High' | 'Medium'>('all');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [callFor, setCallFor] = useState('');
  const [working, setWorking] = useState('');

  useEffect(() => {
    if (me.data?.messageLanguage) setLanguage(me.data.messageLanguage);
  }, [me.data?.messageLanguage]);

  useEffect(() => {
    if (queue.isError) toast.error(queue.error instanceof ApiError ? queue.error.message : 'Could not load the queue');
  }, [queue.isError, queue.error, toast]);

  const filtered = useMemo(
    () => orders.filter((order) => band === 'all' || order.riskBand === band),
    [orders, band],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);
  const selected = filtered.find((order) => order.id === selectedId) || visible[0] || null;
  const canSend = Boolean(whatsapp.data?.configured || whatsapp.data?.demo || me.data?.role === 'demo' || me.data?.isDemo);

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
    await client.cancelQueries({ queryKey: qk.queue });
    const previous = client.getQueryData<{ orders: OrderDetail[] }>(qk.queue);
    client.setQueryData<{ orders: OrderDetail[] }>(qk.queue, (current) =>
      current
        ? { orders: current.orders.map((order) => (ids.includes(order.id) ? { ...order, whatsappStatus: 'sent' } : order)) }
        : current,
    );
    try {
      const body = await api<{ sent: string[]; notice?: string }>('/whatsapp/send', { method: 'POST', body: JSON.stringify({ ids }) });
      const sent = new Set(body.sent);
      client.setQueryData<{ orders: OrderDetail[] }>(qk.queue, (current) =>
        current
          ? {
              orders: current.orders.map((order) =>
                sent.has(order.id) ? { ...order, whatsappStatus: 'sent' } : ids.includes(order.id) && previous
                  ? previous.orders.find((item) => item.id === order.id) || order
                  : order,
              ),
            }
          : current,
      );
      setPicked({});
      if (body.notice) toast.info(body.notice);
      else toast.success('WhatsApp sent.');
    } catch (err) {
      if (previous) client.setQueryData(qk.queue, previous);
      toast.error(err instanceof ApiError ? err.message : 'WhatsApp did not send');
    } finally {
      setSending(false);
      invalidateShop(client);
    }
  }

  async function outcome(id: string, value: 'confirmed' | 'cancelled' | 'no_response') {
    await client.cancelQueries({ queryKey: qk.queue });
    const previous = client.getQueryData<{ orders: OrderDetail[] }>(qk.queue);
    client.setQueryData<{ orders: OrderDetail[] }>(qk.queue, (current) =>
      current ? { orders: current.orders.filter((order) => order.id !== id) } : current,
    );
    try {
      await api(`/orders/${id}/outcome`, { method: 'PATCH', body: JSON.stringify({ outcome: value }) });
      if (selectedId === id) setSelectedId('');
    } catch (err) {
      if (previous) client.setQueryData(qk.queue, previous);
      toast.error(err instanceof ApiError ? err.message : 'Could not save the outcome');
    } finally {
      invalidateShop(client);
    }
  }

  async function voice(order: OrderDetail) {
    try {
      const result = await api<{ audioBase64: string | null; mime: string | null; script: string; notice: string | null }>(
        `/orders/${order.id}/voice`,
        { method: 'POST' },
      );
      if (result.audioBase64 && result.mime) {
        const audio = new Audio(`data:${result.mime};base64,${result.audioBase64}`);
        await audio.play();
      } else if (result.notice) {
        toast.info(result.notice);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Voice failed');
    }
  }

  async function prepaid(id: string) {
    setWorking(id);
    try {
      const body = await api<{ notice?: string | null }>(`/orders/${id}/prepaid`, { method: 'POST' });
      toast.success(body.notice || 'Prepaid checkout is ready.');
      invalidateShop(client);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create the prepaid link');
    } finally {
      setWorking('');
    }
  }

  function runPrimary(order: OrderDetail) {
    const action = actionCopy(order);
    if (action.id === 'prepaid') {
      void prepaid(order.id);
      return;
    }
    if (action.id === 'address' || action.id === 'send') {
      if (canSend) void send([order.id]);
      else {
        const link = waLink(order, textFor(order));
        if (link) window.open(link, '_blank', 'noopener');
      }
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

  if (queue.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading the queue" data-tour-ready="false">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-tour-ready="true">
      <div className="flex flex-wrap items-end justify-between gap-3" data-tour="risk-queue">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-inksoft">Needs a decision</p>
          <h1 className="font-display text-display-2">Confirmation queue</h1>
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

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Risk band">
        {(['all', 'High', 'Medium'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={band === value}
            className={`border-2 border-ink px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${band === value ? 'bg-lime' : 'bg-white'}`}
            onClick={() => {
              setBand(value);
              setPage(0);
            }}
          >
            {value === 'all' ? `All ${orders.length}` : `${value} ${orders.filter((order) => order.riskBand === value).length}`}
          </button>
        ))}
      </div>

      {Object.values(picked).some(Boolean) ? (
        <div className="flex flex-wrap items-center gap-2 border-2 border-ink bg-lime px-3 py-2">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
            {Object.values(picked).filter(Boolean).length} selected
          </span>
          <Button type="button" disabled={sending || !canSend} onClick={() => send(Object.entries(picked).filter(([, on]) => on).map(([id]) => id))}>
            Send selected
          </Button>
          <Button type="button" tone="ghost" onClick={() => setPicked({})}>Clear</Button>
        </div>
      ) : null}

      {!filtered.length ? (
        <p className="border-2 border-ink bg-white px-4 py-8 font-mono text-xs font-bold uppercase tracking-[0.16em] text-inksoft">
          No medium or high risk orders. Score a batch, or ship the low-risk ones.
        </p>
      ) : (
        <div className="border-2 border-ink bg-white">
          {visible.map((order) => {
            const active = selected?.id === order.id;
            return (
              <div
                key={order.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(order.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedId(order.id);
                  }
                }}
                className={`grid w-full grid-cols-[auto_4.25rem_1fr] items-center gap-3 border-b-2 border-ink px-3 py-3 text-left last:border-b-0 sm:grid-cols-[auto_4.25rem_5.5rem_1fr_auto] ${active ? 'bg-hl/50' : 'bg-white'}`}
              >
                <input
                  type="checkbox"
                  aria-label={`Select ${order.externalOrderId}`}
                  checked={Boolean(picked[order.id])}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setPicked((current) => ({ ...current, [order.id]: event.target.checked }))}
                />
                <span className="font-display text-3xl font-black tabular-nums leading-none">{order.riskScore ?? '—'}</span>
                <RiskBadge band={order.riskBand} />
                <span className="min-w-0">
                  <span className="block truncate font-display text-lg font-extrabold uppercase">{order.buyerName}</span>
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-inksoft">
                    {order.externalOrderId} · {order.city} · {order.paymentType === 'cod' ? 'COD' : 'Prepaid'}
                  </span>
                </span>
                <span className="hidden text-right sm:block">
                  <span className="block font-mono text-sm font-bold tabular-nums">{inr(order.orderValue)}</span>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-inksoft">
                    {actionCopy(order).label}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <Pager page={safePage} pageSize={PAGE} total={filtered.length} onPage={setPage} />

      {selected ? (
        <article className="border-2 border-ink bg-paper p-4 shadow-sticker">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">
                <Link href={`/app/orders/${selected.id}`} className="underline decoration-lime decoration-2 underline-offset-4">
                  {selected.buyerName}
                </Link>
              </h2>
              <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-inksoft">
                {inr(selected.orderValue)} · {selected.paymentType === 'cod' ? 'COD' : 'Prepaid'} · {selected.phoneMasked} · {selected.city} {selected.pincode}
              </p>
            </div>
            {canSend ? (
              <label className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
                <input
                  type="checkbox"
                  checked={Boolean(picked[selected.id])}
                  onChange={(event) => setPicked((current) => ({ ...current, [selected.id]: event.target.checked }))}
                />
                Select
              </label>
            ) : null}
          </div>
          <ul className="mt-3 flex flex-wrap gap-2" data-tour={orders[0]?.id === selected.id ? 'risk-reasons' : undefined}>
            {selected.reasons.map((reason) => (
              <li key={reason} className="border-2 border-ink bg-hl px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em]">
                {reason}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm leading-6">{selected.address}</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="border-2 border-ink bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="font-hindi text-sm leading-6">{textFor(selected)}</p>
                {textFor(selected) ? <CopyButton text={textFor(selected)} /> : null}
              </div>
              {selected.messages ? (
                <p className="mt-3 border-t-2 border-dashed border-ink/30 pt-3 text-sm text-ink/75">
                  Prepaid nudge: {selected.messages.prepaid_nudge}
                </p>
              ) : null}
            </div>
            <MessageThread status={selected.whatsappStatus} conversation={selected.conversation} />
          </div>
          {pincodeNote[selected.id] ? <p className="mt-3 text-xs leading-5 text-ink/70">{pincodeNote[selected.id]}</p> : null}
          <OrderActions
            order={selected}
            busy={sending || working === selected.id}
            canSend={canSend}
            tour
            onPrimary={() => runPrimary(selected)}
            onOutcome={(value) => outcome(selected.id, value)}
            onPrepaid={() => prepaid(selected.id)}
            onCall={() => setCallFor(selected.id)}
            onVoice={() => voice(selected)}
            onPin={() => pin(selected)}
          />
          {callFor === selected.id ? <div className="mt-3"><CallBuyer orderId={selected.id} open onClose={() => setCallFor('')} /></div> : null}
          {selected.prepaid?.invoiceUrl ? (
            <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
              Prepaid {selected.prepaid.status} · <a className="underline" href={selected.prepaid.invoiceUrl} target="_blank" rel="noreferrer">Open checkout</a>
            </p>
          ) : null}
        </article>
      ) : (
        <div data-tour="approve-send" className="sr-only">Approve and send</div>
      )}
    </div>
  );
}
