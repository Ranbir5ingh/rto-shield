'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { CallBuyer } from '@/components/CallBuyer';
import { MessageThread } from '@/components/MessageThread';
import { actionCopy, OrderActions } from '@/components/OrderActions';
import { useToast } from '@/components/Toaster';
import { Button, CopyButton, RiskBadge, Skeleton, Dropdown } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { inr } from '@/lib/format';
import { invalidateShop, qk, useMe, useQueue, useWhatsapp } from '@/lib/queries';
import type { OrderDetail, PublicUser } from '@/lib/types';

function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const apply = () => setWide(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  return wide;
}

export default function QueuePage() {
  return (
    <Suspense fallback={<QueueSkeleton />}>
      <QueueScreen />
    </Suspense>
  );
}

function QueueSkeleton() {
  return (
    <div className="mx-auto w-full max-w-page space-y-4 px-4 py-8 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading the queue">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}

function QueueScreen() {
  const toast = useToast();
  const client = useQueryClient();
  const router = useRouter();
  const params = useSearchParams();
  const wide = useWide();
  const orderParam = params?.get('order') || '';
  const queue = useQueue();
  const me = useMe();
  const whatsapp = useWhatsapp();
  const orders = queue.data?.orders ?? [];
  const [language, setLanguage] = useState<PublicUser['messageLanguage']>('hinglish');
  const [pincodeNote, setPincodeNote] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const [band, setBand] = useState<'all' | 'High' | 'Medium'>('all');
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
  const selected = orders.find((order) => order.id === orderParam) || null;
  const canSend = Boolean(whatsapp.data?.configured || whatsapp.data?.demo || me.data?.role === 'demo' || me.data?.isDemo);

  const replace = useCallback((id: string) => {
    const next = new URLSearchParams(params?.toString() || '');
    if (id) next.set('order', id);
    else next.delete('order');
    const query = next.toString();
    router.replace(query ? `/app/queue?${query}` : '/app/queue', { scroll: false });
  }, [params, router]);

  // Desktop: keep the first order selected so the detail pane is never empty.
  useEffect(() => {
    if (!wide || orderParam || !filtered[0]) return;
    replace(filtered[0].id);
  }, [wide, orderParam, filtered, replace]);

  useEffect(() => {
    if (orderParam && queue.isSuccess && !orders.some((order) => order.id === orderParam)) replace('');
  }, [orderParam, orders, queue.isSuccess, replace]);

  // Mobile: rows open the full order page. Desktop: rows select inline.
  const openRow = useCallback((id: string) => {
    if (wide) replace(id);
    else router.push(`/app/orders/${id}`);
  }, [wide, replace, router]);

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
      if (orderParam === id) replace('');
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

  function move(delta: number) {
    if (!filtered.length) return;
    const index = Math.max(0, filtered.findIndex((order) => order.id === (selected?.id || filtered[0].id)));
    const next = filtered[Math.min(filtered.length - 1, Math.max(0, index + delta))];
    openRow(next.id);
    document.getElementById(`queue-row-${next.id}`)?.focus();
  }

  if (queue.isLoading) return <QueueSkeleton />;

  const detail = selected ? (
    <QueueDetail
      order={selected}
      text={textFor(selected)}
      note={pincodeNote[selected.id] || ''}
      busy={sending || working === selected.id}
      canSend={canSend}
      calling={callFor === selected.id}
      picked={Boolean(picked[selected.id])}
      onPick={(on) => setPicked((current) => ({ ...current, [selected.id]: on }))}
      onPrimary={() => runPrimary(selected)}
      onOutcome={(value) => outcome(selected.id, value)}
      onPrepaid={() => prepaid(selected.id)}
      onCall={() => setCallFor(selected.id)}
      onVoice={() => voice(selected)}
      onPin={() => pin(selected)}
      onCloseCall={() => setCallFor('')}
    />
  ) : (
    <div className="sticker-sm p-8 text-center">
      <p className="eyebrow text-inksoft">No order selected</p>
      <p className="mt-3 text-sm leading-6 text-ink/70">
        Pick an order from the list to read the message and take the next action.
      </p>
    </div>
  );

  const pickedIds = Object.entries(picked).filter(([, on]) => on).map(([id]) => id);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-page flex-col px-4 sm:px-6 lg:px-8" data-tour-ready="true">
      {/* header */}
      <div className="shrink-0 pb-4 pt-5 lg:pt-6" data-tour="risk-queue">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-inksoft">
              Needs a decision · {orders.length} waiting
            </p>
            <h1 className="mt-2 font-display text-[1.7rem] font-black uppercase leading-none tracking-tight md:text-4xl">
              Confirmation queue
            </h1>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <span className="eyebrow text-inksoft">Message</span>
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
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Risk band">
          {(['all', 'High', 'Medium'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={band === value}
              className={`border-2 border-ink px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition ${
                band === value ? 'bg-lime shadow-sticker-sm' : 'bg-white hover:bg-hl/40'
              }`}
              onClick={() => setBand(value)}
            >
              {value === 'all' ? `All ${orders.length}` : `${value} ${orders.filter((order) => order.riskBand === value).length}`}
            </button>
          ))}
        </div>
        {pickedIds.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2.5 border-2 border-ink bg-lime px-4 py-2.5 shadow-sticker-sm">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
              {pickedIds.length} selected
            </span>
            <Button type="button" disabled={sending || !canSend} onClick={() => send(pickedIds)}>
              {sending ? 'Sending…' : 'Send selected'}
            </Button>
            <Button type="button" tone="ghost" onClick={() => setPicked({})}>Clear</Button>
          </div>
        ) : null}
      </div>

      {/* body: list + detail */}
      <div className="grid min-h-0 flex-1 gap-4 pb-6 lg:grid-cols-[21rem_minmax(0,1fr)]">
        <div
          className="sticker-sm min-h-0 overflow-y-auto overscroll-contain"
          role="listbox"
          aria-label="Orders waiting for a decision"
          aria-activedescendant={selected ? `queue-row-${selected.id}` : undefined}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            const tag = (event.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'A' || tag === 'TEXTAREA') return;
            event.preventDefault();
            move(event.key === 'ArrowDown' ? 1 : -1);
          }}
        >
          {!filtered.length ? (
            <p className="px-5 py-10 text-center font-mono text-xs font-bold uppercase leading-6 tracking-[0.16em] text-inksoft">
              No medium or high risk orders.<br />Score a batch, or ship the low-risk ones.
            </p>
          ) : filtered.map((order, index) => {
            const active = wide && selected?.id === order.id;
            return (
              <div
                key={order.id}
                id={`queue-row-${order.id}`}
                role="option"
                aria-selected={active}
                tabIndex={0}
                onClick={() => openRow(order.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openRow(order.id);
                  }
                }}
                className={`grid w-full cursor-pointer grid-cols-[auto_3.5rem_1fr] items-center gap-3 border-b-2 border-ink/60 px-4 py-3.5 text-left transition last:border-b-0 hover:bg-hl/30 ${
                  active ? 'bg-hl/60' : 'bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  aria-label={`Select ${order.externalOrderId}`}
                  checked={Boolean(picked[order.id])}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setPicked((current) => ({ ...current, [order.id]: event.target.checked }))}
                  className="h-4 w-4 accent-[#1B1712]"
                />
                <span className="font-display text-[2rem] font-black tabular-nums leading-none">{order.riskScore ?? '—'}</span>
                <div className="min-w-0">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-display text-base font-extrabold uppercase tracking-tight">{order.buyerName}</span>
                    <RiskBadge band={order.riskBand} />
                  </span>
                  <span className="mt-1 block truncate font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-inksoft">
                    {order.externalOrderId} · {order.city} · {inr(order.orderValue)}
                  </span>
                  <span className="mt-1 block truncate font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink/60" data-tour={index === 0 ? 'risk-reasons' : undefined}>
                    {(order.reasons[0] || actionCopy(order).label)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden min-h-0 overflow-y-auto overscroll-contain pb-2 pr-0.5 lg:block">
          {detail}
        </div>
      </div>
    </div>
  );
}

function QueueDetail({
  order,
  text,
  note,
  busy,
  canSend,
  calling,
  picked,
  onPick,
  onPrimary,
  onOutcome,
  onPrepaid,
  onCall,
  onVoice,
  onPin,
  onCloseCall,
}: {
  order: OrderDetail;
  text: string;
  note: string;
  busy: boolean;
  canSend: boolean;
  calling: boolean;
  picked: boolean;
  onPick: (on: boolean) => void;
  onPrimary: () => void;
  onOutcome: (value: 'confirmed' | 'cancelled' | 'no_response') => void;
  onPrepaid: () => void;
  onCall: () => void;
  onVoice: () => void;
  onPin: () => void;
  onCloseCall: () => void;
}) {
  return (
    <article className="sticker p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow text-inksoft">Order detail</p>
          <h2 className="mt-1.5 font-display text-2xl font-black uppercase tracking-tight md:text-3xl">
            {order.buyerName}
          </h2>
          <p className="mt-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-inksoft">
            {order.externalOrderId} · {inr(order.orderValue)} · {order.paymentType === 'cod' ? 'COD' : 'Prepaid'}
          </p>
          <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-inksoft">
            {order.phoneMasked} · {order.city} {order.pincode}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <RiskBadge band={order.riskBand} />
          <span className="font-display text-5xl font-black tabular-nums leading-none">{order.riskScore ?? '—'}</span>
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Risk reasons">
        {order.reasons.map((reason) => (
          <li key={reason} className="border-2 border-ink bg-hl px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em]">
            {reason}
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t-2 border-dashed border-ink/20 pt-4 text-[15px] leading-7 text-ink/80">{order.address}</p>

      <div className="mt-4">
        <OrderActions
          order={order}
          busy={busy}
          canSend={canSend}
          onPrimary={onPrimary}
          onOutcome={onOutcome}
          onPrepaid={onPrepaid}
          onCall={onCall}
          onVoice={onVoice}
          onPin={onPin}
        />
      </div>
      {calling ? <div className="mt-4"><CallBuyer orderId={order.id} open onClose={onCloseCall} /></div> : null}
      {order.prepaid?.invoiceUrl ? (
        <p className="mt-4 border-2 border-ink bg-lime/40 p-4 font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
          Prepaid {order.prepaid.status} · <a className="underline" href={order.prepaid.invoiceUrl} target="_blank" rel="noreferrer">Open checkout</a>
        </p>
      ) : null}

      <div className="mt-6 grid gap-4">
        <div className="border-2 border-ink bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="eyebrow text-inksoft">Message draft</p>
            {text ? <CopyButton text={text} /> : null}
          </div>
          <p className="mt-3 font-hindi text-[15px] leading-7">{text}</p>
          {order.messages ? (
            <p className="mt-3 border-t-2 border-dashed border-ink/20 pt-3 text-sm leading-6 text-ink/70">
              Prepaid nudge: {order.messages.prepaid_nudge}
            </p>
          ) : null}
        </div>
        <MessageThread status={order.whatsappStatus} conversation={order.conversation} />
      </div>
      {note ? <p className="mt-4 text-sm leading-6 text-ink/70">{note}</p> : null}

      {canSend ? (
        <label className="mt-5 flex items-center gap-2.5 border-t-2 border-dashed border-ink/20 pt-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-inksoft">
          <input type="checkbox" checked={picked} onChange={(event) => onPick(event.target.checked)} className="h-4 w-4 accent-[#1B1712]" />
          Select for bulk send
        </label>
      ) : null}
    </article>
  );
}
