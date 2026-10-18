'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CallBuyer } from '@/components/CallBuyer';
import { MessageThread } from '@/components/MessageThread';
import { actionCopy, OrderActions } from '@/components/OrderActions';
import { PincodeCheck, type PincodeStatus, type PincodeView } from '@/components/PincodeCheck';
import { useToast } from '@/components/Toaster';
import { CopyButton, Flag, Skeleton, Dropdown } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { engineLabel, inr, predictorLabel } from '@/lib/format';
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
  const [scope, setScope] = useState<'action' | 'open'>('action');
  const actionQueue = useQueue('action');
  const openQueue = useQueue('open');
  const queue = scope === 'open' ? openQueue : actionQueue;
  const me = useMe();
  const whatsapp = useWhatsapp();
  const orders = queue.data?.orders ?? [];
  const [language, setLanguage] = useState<PublicUser['messageLanguage']>('hinglish');
  const [pinByOrder, setPinByOrder] = useState<Record<string, { status: PincodeStatus; view?: PincodeView }>>({});
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const suppressClick = useRef(false);
  const [sending, setSending] = useState(false);
  const [band, setBand] = useState<'all' | 'High' | 'Medium' | 'Low'>('all');
  const [callFor, setCallFor] = useState('');
  const [working, setWorking] = useState('');
  // Snapshot the queue size when the filter changes so the progress bar can show "cleared".
  const [baseline, setBaseline] = useState({ key: 'action:all', total: 0 });

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

  const filterKey = `${scope}:${band}`;
  useEffect(() => {
    setBaseline((current) => {
      if (current.key !== filterKey) return { key: filterKey, total: filtered.length };
      if (current.total === 0 && filtered.length > 0) return { key: filterKey, total: filtered.length };
      return current;
    });
  }, [filterKey, filtered.length]);

  const selected = orders.find((order) => order.id === orderParam) || null;
  const selectedIndex = selected ? filtered.findIndex((order) => order.id === selected.id) : -1;
  const cleared = Math.max(0, baseline.total - filtered.length);
  const progress = baseline.total > 0 ? Math.round((cleared / baseline.total) * 100) : 0;
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

  async function send(ids: string[]): Promise<boolean> {
    if (!ids.length) return false;
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
      return true;
    } catch (err) {
      if (previous) client.setQueryData(qk.queue, previous);
      toast.error(err instanceof ApiError ? err.message : 'WhatsApp did not send');
      return false;
    } finally {
      setSending(false);
      invalidateShop(client);
    }
  }

  // After acting on an order, land on the next one in the list instead of an empty pane.
  function advanceFrom(id: string) {
    const index = filtered.findIndex((order) => order.id === id);
    const remaining = filtered.filter((order) => order.id !== id);
    const next = remaining[Math.min(Math.max(index, 0), remaining.length - 1)];
    replace(next ? next.id : '');
  }

  async function outcome(id: string, value: 'confirmed' | 'cancelled' | 'no_response') {
    const doomed = filtered.findIndex((order) => order.id === id);
    const survivors = filtered.filter((order) => order.id !== id);
    const nextId = survivors[Math.min(Math.max(doomed, 0), survivors.length - 1)]?.id ?? '';
    await client.cancelQueries({ queryKey: qk.queue });
    const previous = client.getQueryData<{ orders: OrderDetail[] }>(qk.queue);
    client.setQueryData<{ orders: OrderDetail[] }>(qk.queue, (current) =>
      current ? { orders: current.orders.filter((order) => order.id !== id) } : current,
    );
    try {
      await api(`/orders/${id}/outcome`, { method: 'PATCH', body: JSON.stringify({ outcome: value }) });
      if (orderParam === id) replace(nextId);
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
      if (canSend) void send([order.id]).then((ok) => {
        if (ok) advanceFrom(order.id);
      });
      else {
        const link = waLink(order, textFor(order));
        if (link) window.open(link, '_blank', 'noopener');
      }
    }
  }

  function setPickedOne(id: string, on: boolean) {
    setPicked((current) => ({ ...current, [id]: on }));
  }

  async function pin(order: OrderDetail) {
    setPinByOrder((current) => ({ ...current, [order.id]: { status: 'loading' } }));
    try {
      const body = await api<PincodeView>(`/pincode/${order.pincode}`);
      setPinByOrder((current) => ({ ...current, [order.id]: { status: 'ready', view: body } }));
      const place = body.locality || body.region || 'area on file';
      toast.info(`${order.pincode}: ${place}. Context only, not a ban.`);
    } catch (err) {
      setPinByOrder((current) => ({ ...current, [order.id]: { status: 'error' } }));
      toast.error(err instanceof ApiError ? err.message : 'Could not check this pincode');
    }
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
      pinState={pinByOrder[selected.id] || null}
      busy={sending || working === selected.id}
      sending={sending}
      canSend={canSend}
      calling={callFor === selected.id}
      picked={Boolean(picked[selected.id])}
      pos={selectedIndex >= 0 ? selectedIndex + 1 : 1}
      total={filtered.length}
      progress={progress}
      onPrev={() => move(-1)}
      onNext={() => move(1)}
      onPick={(on) => setPicked((current) => ({ ...current, [selected.id]: on }))}
      onPrimary={() => runPrimary(selected)}
      onOutcome={(value) => outcome(selected.id, value)}
      onPrepaid={() => prepaid(selected.id)}
      onCall={() => setCallFor(selected.id)}
      onVoice={() => voice(selected)}
      onPin={() => pin(selected)}
      onSend={() => { void send([selected.id]); }}
      onCloseCall={() => setCallFor('')}
    />
  ) : (
    <div className="sticker-sm p-8 text-center">
      <p className="eyebrow text-inksoft">{orders.length === 0 && baseline.total > 0 ? 'Queue cleared' : 'No order selected'}</p>
      <p className="mt-3 text-sm leading-6 text-ink/70">
        {orders.length === 0 && baseline.total > 0
          ? `All ${baseline.total} orders handled. Nice work — the low-risk ones can ship.`
          : 'Pick an order from the list to read the message and take the next action.'}
      </p>
    </div>
  );

  const pickedIds = Object.entries(picked).filter(([, on]) => on).map(([id]) => id);
  const selecting = pickedIds.length > 0;

  return (
    <div className="mx-auto flex h-full min-h-0 w-full flex-col px-4 sm:px-6 lg:px-8 xl:px-10" data-tour-ready="true">
      {/* header: title, filters and message picker share one line */}
      <div className="shrink-0 pb-3 pt-4" data-tour="risk-queue">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1 basis-64">
            <h1 className="font-display text-2xl font-black uppercase leading-none tracking-tight md:text-[1.7rem]">
              Confirmation queue
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Which orders">
            <button
              type="button"
              role="tab"
              data-tour-open="needs-action"
              aria-selected={scope === 'action'}
              className={`border-2 border-ink px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition ${
                scope === 'action' ? 'bg-lime shadow-sticker-sm' : 'bg-white hover:bg-hl/40'
              }`}
              onClick={() => {
                setScope('action');
                setBand('all');
              }}
            >
              Needs action {actionQueue.data?.orders.length ?? 0}
            </button>
            <button
              type="button"
              role="tab"
              data-tour="all-open"
              data-tour-open="all-open"
              aria-selected={scope === 'open'}
              className={`border-2 border-ink px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition ${
                scope === 'open' ? 'bg-lime shadow-sticker-sm' : 'bg-white hover:bg-hl/40'
              }`}
              onClick={() => {
                setScope('open');
                setBand('all');
              }}
            >
              All open {openQueue.data?.orders.length ?? 0}
            </button>
            {(scope === 'open' ? (['High', 'Medium', 'Low'] as const) : (['High', 'Medium'] as const)).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                data-tour={value === 'Low' ? 'band-low' : undefined}
                aria-selected={band === value}
                className={`border-2 border-ink px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition ${
                  band === value ? 'bg-hl shadow-sticker-sm' : 'bg-white hover:bg-hl/40'
                }`}
                onClick={() => setBand(value)}
              >
                {value} {orders.filter((order) => order.riskBand === value).length}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2.5 text-sm">
            <span className="eyebrow text-inksoft">Message</span>
            <Dropdown
              label="Message language"
              reveal="language"
              listTour="message-language"
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
        {selecting ? (
          <div data-selection-bar="true" className="mt-3 flex flex-nowrap items-center gap-1.5 border-2 border-ink bg-lime px-2 py-1.5 shadow-sticker-sm lg:gap-2.5 lg:px-4 lg:py-2.5">
            <span className="shrink-0 whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-[0.06em] lg:text-[11px] lg:tracking-[0.14em]">
              {pickedIds.length} selected
            </span>
            <button type="button" className="inline-flex shrink-0 items-center justify-center whitespace-nowrap border-2 border-ink bg-white px-1.5 py-1 font-mono text-[10px] font-bold uppercase leading-none tracking-[0.04em] shadow-[2px_2px_0_0_#1B1712] lg:px-7 lg:py-4 lg:text-[12px] lg:tracking-[0.18em] lg:shadow-[4px_4px_0_#1B1712]" onClick={() => setPicked(Object.fromEntries(filtered.map((order) => [order.id, true])))}>
              Select all
            </button>
            <button type="button" className="inline-flex shrink-0 items-center justify-center whitespace-nowrap border-2 border-ink bg-white px-1.5 py-1 font-mono text-[10px] font-bold uppercase leading-none tracking-[0.04em] shadow-[2px_2px_0_0_#1B1712] disabled:opacity-50 lg:bg-lime lg:px-7 lg:py-4 lg:text-[12px] lg:tracking-[0.18em] lg:shadow-[4px_4px_0_#1B1712]" disabled={sending || !canSend} onClick={() => send(pickedIds)}>
              {sending ? 'Sending…' : (
                <>
                  <span className="lg:hidden">Send</span>
                  <span className="hidden lg:inline">Send selected</span>
                </>
              )}
            </button>
            <button type="button" className="inline-flex shrink-0 items-center justify-center whitespace-nowrap border-2 border-ink bg-white px-1.5 py-1 font-mono text-[10px] font-bold uppercase leading-none tracking-[0.04em] shadow-[2px_2px_0_0_#1B1712] lg:px-7 lg:py-4 lg:text-[12px] lg:tracking-[0.18em] lg:shadow-[4px_4px_0_#1B1712]" onClick={() => setPicked({})}>
              Clear
            </button>
          </div>
        ) : null}
      </div>

      {/* body: list + detail */}
      <div className="grid min-h-0 flex-1 gap-5 pb-6 lg:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)]">
        <div
          className="sticker-sm min-h-0 overflow-y-auto overscroll-contain"
          data-tour="queue-list"
          role="listbox"
          aria-label="Orders waiting for a decision"
          aria-activedescendant={selected ? `queue-row-${selected.id}` : undefined}
          tabIndex={0}
          onKeyDown={(event) => {
            const tag = (event.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'A' || tag === 'TEXTAREA') return;
            if (event.key === 'ArrowDown' || event.key === 'j') {
              event.preventDefault();
              move(1);
            } else if (event.key === 'ArrowUp' || event.key === 'k') {
              event.preventDefault();
              move(-1);
            }
          }}
        >
          {!filtered.length ? (
            <p className="px-5 py-10 text-center font-mono text-xs font-bold uppercase leading-6 tracking-[0.16em] text-inksoft">
              {scope === 'open'
                ? 'No open orders in this view.'
                : <>No medium or high risk orders.<br />Low-risk orders are on All open.</>}
            </p>
          ) : filtered.map((order, index) => {
            const active = wide && selected?.id === order.id;
            return (
              <div
                key={order.id}
                id={`queue-row-${order.id}`}
                data-order-id={order.id}
                data-tour-row={index === 0 ? '1' : undefined}
                role="option"
                aria-selected={active}
                tabIndex={0}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  const target = event.target instanceof Element ? event.target : null;
                  if (target?.closest('input,button,a,label')) return;
                  const startX = event.clientX;
                  const startY = event.clientY;
                  const timer = window.setTimeout(() => {
                    suppressClick.current = true;
                    setPickedOne(order.id, true);
                  }, 450);
                  const end = () => {
                    window.clearTimeout(timer);
                    window.removeEventListener('pointermove', move);
                    window.removeEventListener('pointerup', end);
                    window.removeEventListener('pointercancel', end);
                  };
                  const move = (ev: PointerEvent) => {
                    if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) end();
                  };
                  window.addEventListener('pointermove', move);
                  window.addEventListener('pointerup', end);
                  window.addEventListener('pointercancel', end);
                }}
                onClick={() => {
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    return;
                  }
                  if (selecting) {
                    setPickedOne(order.id, !picked[order.id]);
                    return;
                  }
                  openRow(order.id);
                }}
                onContextMenu={(event) => {
                  if (suppressClick.current) event.preventDefault();
                }}
                onKeyDown={(event) => {
                  const target = event.target instanceof Element ? event.target : null;
                  if (target?.closest('input,button,a')) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    if (selecting) setPickedOne(order.id, !picked[order.id]);
                    else openRow(order.id);
                  }
                }}
                className={`grid w-full cursor-pointer grid-cols-[auto_2.75rem_minmax(0,1fr)_auto] items-center gap-3 border-b-2 border-ink/60 px-5 py-3.5 text-left transition last:border-b-0 hover:bg-hl/30 ${
                  active ? 'bg-hl/60' : 'bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  aria-label={`Select ${order.externalOrderId}`}
                  checked={Boolean(picked[order.id])}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setPickedOne(order.id, event.target.checked)}
                  className="h-4 w-4 accent-[#1B1712]"
                />
                <span className="font-display text-[1.65rem] font-black tabular-nums leading-none">{order.riskScore ?? '—'}</span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-base font-extrabold uppercase tracking-tight">{order.buyerName}</span>
                </span>
                <Flag
                  tone={order.riskBand === 'High' ? 'red' : order.riskBand === 'Medium' ? 'banana' : order.riskBand === 'Low' ? 'go' : 'ghost'}
                >
                  <span title={order.riskBand ?? 'Unscored'} aria-label={order.riskBand ?? 'Unscored'}>
                    {(order.riskBand || '—')[0]}
                  </span>
                </Flag>
              </div>
            );
          })}
        </div>

        <div className="hidden min-h-0 lg:block">
          {detail}
        </div>
      </div>
    </div>
  );
}

function QueueDetail({
  order,
  text,
  pinState,
  busy,
  sending,
  canSend,
  calling,
  picked,
  pos,
  total,
  progress,
  onPrev,
  onNext,
  onPick,
  onPrimary,
  onOutcome,
  onPrepaid,
  onCall,
  onVoice,
  onPin,
  onSend,
  onCloseCall,
}: {
  order: OrderDetail;
  text: string;
  pinState: { status: PincodeStatus; view?: PincodeView } | null;
  busy: boolean;
  sending: boolean;
  canSend: boolean;
  calling: boolean;
  picked: boolean;
  pos: number;
  total: number;
  progress: number;
  onPrev: () => void;
  onNext: () => void;
  onPick: (on: boolean) => void;
  onPrimary: () => void;
  onOutcome: (value: 'confirmed' | 'cancelled' | 'no_response') => void;
  onPrepaid: () => void;
  onCall: () => void;
  onVoice: () => void;
  onPin: () => void;
  onSend: () => void;
  onCloseCall: () => void;
}) {
  return (
    <article className="sticker flex h-full min-h-0 flex-col">
      {/* fixed action deck: the bar is a normal flex child, the body scrolls inside */}
      <div className="shrink-0 border-b-2 border-ink bg-white">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-6 py-3">
          <div className="min-w-0 flex-1 basis-44">
            <p className="eyebrow text-inksoft">Now reviewing</p>
            <p className="mt-1 truncate font-display text-lg font-black uppercase tracking-tight">
              {order.buyerName} <span className="mx-1 font-bold text-ink/30">·</span> {order.riskScore ?? '—'}
            </p>
          </div>
          <OrderActions
            order={order}
            busy={busy}
            canSend={canSend}
            compact
            tour
            showHint={false}
            onPrimary={onPrimary}
            onOutcome={onOutcome}
            onPrepaid={onPrepaid}
            onCall={onCall}
            onVoice={onVoice}
            onPin={onPin}
          />
          <div className="flex items-center gap-2" role="group" aria-label="Walk the queue">
            <button
              type="button"
              onClick={onPrev}
              disabled={pos <= 1}
              aria-label="Previous order"
              className="grid h-9 w-9 place-items-center border-2 border-ink bg-white font-display text-base font-black shadow-sticker-sm transition hover:bg-hl disabled:opacity-30 disabled:hover:bg-white"
            >
              ‹
            </button>
            <span className="font-mono text-[11px] font-bold tracking-[0.08em]">{pos} OF {total}</span>
            <button
              type="button"
              onClick={onNext}
              disabled={pos >= total}
              aria-label="Next order"
              className="grid h-9 w-9 place-items-center border-2 border-ink bg-white font-display text-base font-black shadow-sticker-sm transition hover:bg-hl disabled:opacity-30 disabled:hover:bg-white"
            >
              ›
            </button>
          </div>
        </div>
        <div
          className="h-1.5 border-t-2 border-ink bg-paper"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Queue cleared"
          title={progress > 0 ? `${progress}% cleared` : 'Clear orders to fill this bar'}
        >
          <div className="h-full bg-lime transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="p-6 sm:p-8">
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          <div className="border-t-2 border-dashed border-ink/25 pt-5">
            <p className="eyebrow text-inksoft">Why flagged</p>
            <ul className="mt-3.5 flex flex-wrap gap-1.5" aria-label="Risk reasons" data-tour="why-flagged">
              {order.reasons.map((reason) => (
                <li key={reason} className="border border-ink/60 bg-hl/70 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em]">
                  {reason}
                </li>
              ))}
            </ul>
            {pinState ? <PincodeCheck status={pinState.status} view={pinState.view} /> : null}
            <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-inksoft">
              Reasons from the order facts. Score from {predictorLabel(order.model)}.
            </p>
            <p className="mt-4 text-sm leading-6 text-ink/70">
              {order.externalOrderId} · {inr(order.orderValue)} · {order.paymentType === 'cod' ? 'COD' : 'Prepaid'} · {order.phoneMasked}
              <br />
              {order.city} {order.pincode}
            </p>
            <p className="mt-3 text-[15px] leading-7 text-ink/75">{order.address}</p>
          </div>
          <div className="border-t-2 border-dashed border-ink/25 pt-5" data-tour="message-draft">
            <p className="eyebrow text-inksoft">Message draft</p>
            <p className="mt-3.5 font-hindi text-[15px] leading-7">{text || 'No draft yet.'}</p>
            {order.messages ? (
              <p className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-inksoft">
                Draft from {engineLabel(order.messages.source)}
              </p>
            ) : null}
            {order.messages ? (
              <p className="mt-3 text-[13px] leading-6 text-ink/60">
                Prepaid nudge: {order.messages.prepaid_nudge}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <CopyButton text={text} tour="copy-draft" />
              <button
                type="button"
                data-tour="send-whatsapp"
                className="btn-go !px-3 !py-2 !text-[11px] !tracking-[0.08em] !shadow-[3px_3px_0_#1B1712]"
                disabled={sending}
                onClick={onSend}
              >
                {sending ? 'Sending…' : 'Send on WhatsApp'}
              </button>
            </div>
          </div>
        </div>

        {calling ? <div className="mt-8"><CallBuyer orderId={order.id} open onClose={onCloseCall} /></div> : null}
        {order.prepaid?.invoiceUrl ? (
          <p className="mt-8 border-2 border-ink bg-lime/40 p-4 font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
            Prepaid {order.prepaid.status} · <a className="underline" href={order.prepaid.invoiceUrl} target="_blank" rel="noreferrer">Open checkout</a>
          </p>
        ) : null}

        <div className="mt-8 border-t-2 border-dashed border-ink/25 pt-6" data-tour="conversation">
          <p className="eyebrow mb-4 text-inksoft">Conversation</p>
          <MessageThread status={order.whatsappStatus} conversation={order.conversation} />
        </div>

        {order.interventionWhy ? (
          <p className="mt-8 border-t-2 border-dashed border-ink/25 pt-5 font-mono text-[11px] font-bold uppercase leading-6 tracking-[0.08em] text-inksoft">
            {order.interventionWhy}
          </p>
        ) : null}

        {canSend ? (
          <label className="mt-8 flex items-center gap-2.5 border-t-2 border-dashed border-ink/25 pt-6 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-inksoft">
            <input type="checkbox" checked={picked} onChange={(event) => onPick(event.target.checked)} className="h-4 w-4 accent-[#1B1712]" />
            Select for bulk send
          </label>
        ) : null}
      </div>
      </div>
    </article>
  );
}
