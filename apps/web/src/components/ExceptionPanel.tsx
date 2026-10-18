'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { CallBuyer } from '@/components/CallBuyer';
import { MessageThread } from '@/components/MessageThread';
import { PincodeCheck, type PincodeStatus, type PincodeView } from '@/components/PincodeCheck';
import { useToast } from '@/components/Toaster';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button, Flag } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import {
  DEMO_CALL_LABEL,
  EXTRA_CALL_LABEL,
  EXTRA_CALL_USED,
  RESET_CALL_LABEL,
  autopilotCallLine,
  demoCallBudgetLine,
  extraCallResult,
  outcomeAfter,
  type CallResult,
  type DemoCallBudget,
} from '@/lib/extra-call';
import { inr } from '@/lib/format';
import { invalidateShop, qk, useMe } from '@/lib/queries';
import { isDemoSession } from '@/lib/tours';
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

function CallResultBox({ result }: { result: CallResult }) {
  return (
    <div className="mt-3 border-2 border-ink bg-lime/40 px-3 py-3" data-call-result={result.kind} role="status">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]">Result</p>
      <p className="mt-1 font-display text-xl font-black uppercase">{result.label}</p>
      {result.kind === 'simulated' ? <p className="mt-1 text-sm leading-6">No answer. The buyer was not dialed.</p> : null}
      {result.answered ? <p className="mt-1 text-sm leading-6">This order left Exceptions.</p> : null}
    </div>
  );
}

export function ExceptionPanel({ order }: { order: OrderDetail | null }) {
  const toast = useToast();
  const client = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const demo = isDemoSession(me.data);
  const [saving, setSaving] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [pinState, setPinState] = useState<{ status: PincodeStatus; view?: PincodeView } | null>(null);
  const [live, setLive] = useState<OrderDetail | null>(null);
  const [demoResult, setDemoResult] = useState<CallResult | null>(null);
  const [callEpoch, setCallEpoch] = useState(0);
  const [budgetTick, setBudgetTick] = useState(0);
  const [callBudget, setCallBudget] = useState<DemoCallBudget | null>(null);
  const baseline = useRef(0);
  const pollRef = useRef<number | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef(false);

  function showResult() {
    pendingScroll.current = true;
  }

  const shown = live && order && live.id === order.id ? live : order;

  useEffect(() => {
    setCallOpen(false);
    setPinState(null);
    setLive(null);
    setDemoResult(null);
    if (pollRef.current) window.clearInterval(pollRef.current);
  }, [order?.id]);

  useEffect(() => {
    if (!demo) {
      setCallBudget(null);
      return;
    }
    let stop = false;
    void api<DemoCallBudget>('/demo/call-budget')
      .then((budget) => {
        if (!stop) setCallBudget(budget);
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [demo, order?.id, budgetTick]);

  useEffect(() => {
    if (!live || !order || live.id !== order.id) return;
    if ((order.extraCall?.outcome || '') === (live.extraCall?.outcome || '') && order.stage === live.stage) setLive(null);
  }, [order, live]);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    const current = live && order && live.id === order.id ? live : order;
    if (!current || current.extraCall?.outcome !== 'calling') return;
    let stop = false;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const next = await api<OrderDetail>(`/orders/${current.id}`);
          if (stop || !next.extraCall || next.extraCall.outcome === 'calling') return;
          setLive(next);
          client.setQueryData(qk.order(next.id), next);
          invalidateShop(client);
        } catch {
          /* the next tick retries */
        }
      })();
    }, 2000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [order, live, client]);

  function remember() {
    if (pathname === '/app/queue' && order) router.replace(`/app/queue?order=${order.id}`);
  }

  function watchDemo(index: number, id: string) {
    if (pollRef.current) window.clearInterval(pollRef.current);
    let ticks = 0;
    pollRef.current = window.setInterval(() => {
      ticks += 1;
      void (async () => {
        try {
          const next = await api<OrderDetail>(`/orders/${id}`);
          const found = outcomeAfter(next, index);
          if (found && found.kind !== 'calling') {
            setLive(next);
            setDemoResult(found);
            client.setQueryData(qk.order(next.id), next);
            invalidateShop(client);
            if (pollRef.current) window.clearInterval(pollRef.current);
            return;
          }
        } catch {
          /* keep waiting for the call outcome */
        }
        if (ticks >= 8) {
          setDemoResult(extraCallResult('no_answer'));
          if (pollRef.current) window.clearInterval(pollRef.current);
        }
      })();
    }, 1500);
  }

  function resetDemoCall() {
    setDemoResult(null);
    setCallEpoch((current) => current + 1);
    setBudgetTick((current) => current + 1);
    setCallOpen(true);
  }

  function onDemoPlan(plan: { mode: string; notice: string | null; order?: OrderDetail }) {
    if (!order) return;
    if (plan.mode === 'starting') {
      baseline.current = (shown?.timeline || []).length;
      return;
    }
    if (plan.order) {
      setLive(plan.order);
      client.setQueryData(qk.order(plan.order.id), plan.order);
      invalidateShop(client);
      const found = outcomeAfter(plan.order, baseline.current);
      if (found) {
        setDemoResult(found);
        showResult();
        return;
      }
    }
    if (plan.mode === 'simulated' || /simulated call/i.test(plan.notice || '')) {
      setDemoResult(extraCallResult('simulated'));
      showResult();
      return;
    }
    if (plan.mode === 'ended') {
      if (demoResult && demoResult.kind !== 'calling') return;
      setDemoResult(extraCallResult('calling'));
      watchDemo(baseline.current, order.id);
      return;
    }
    setDemoResult(extraCallResult('calling'));
  }

  async function mark(outcome: 'confirmed' | 'cancelled') {
    if (!shown || saving) return;
    setSaving(outcome);
    try {
      await api(`/orders/${shown.id}/outcome`, { method: 'PATCH', body: JSON.stringify({ outcome }) });
      invalidateShop(client);
      toast.success(outcome === 'confirmed' ? 'Confirmed.' : 'Cancelled.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save');
    } finally {
      setSaving('');
    }
  }

  async function pin() {
    if (!shown) return;
    setPinState({ status: 'loading' });
    try {
      const body = await api<PincodeView>(`/pincode/${shown.pincode}`);
      setPinState({ status: 'ready', view: body });
      const place = body.locality || body.region || 'area on file';
      toast.info(`${shown.pincode}: ${place}. Context only, not a ban.`);
    } catch (err) {
      setPinState({ status: 'error' });
      toast.error(err instanceof ApiError ? err.message : 'Could not check this pincode');
    }
  }

  async function useReply() {
    if (!shown || saving) return;
    setSaving('address');
    try {
      await api(`/orders/${shown.id}/address`, {
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

  async function tryOneMore() {
    if (!shown || saving || shown.extraCall) return;
    setSaving('call');
    remember();
    try {
      const body = await api<{ order: OrderDetail }>(`/orders/${shown.id}/extra-call`, { method: 'POST', body: '{}' });
      setLive(body.order);
      client.setQueryData(qk.order(body.order.id), body.order);
      invalidateShop(client);
      showResult();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not place the call');
    } finally {
      setSaving('');
    }
  }

  const callsLeft = !callBudget?.applies || callBudget.remaining > 0;
  const persisted = extraCallResult(shown?.extraCall?.outcome);
  const result = persisted || demoResult;

  useEffect(() => {
    if (!pendingScroll.current || !result) return;
    pendingScroll.current = false;
    resultRef.current?.scrollIntoView({ block: 'nearest' });
  }, [result]);
  const answered = Boolean(result?.answered);
  const used = Boolean(shown?.extraCall);
  const calling = shown?.extraCall?.outcome === 'calling' || saving === 'call';

  return (
    <article className="border-2 border-ink bg-paper p-4 shadow-[4px_4px_0_0_#1B1712] sm:p-5" data-tour="exception-order">
      {shown ? (
        <>
          <p className="eyebrow">{exceptionLabel(shown)}</p>
          <h2 className="mt-2 break-words font-display text-2xl font-black uppercase">{shown.buyerName}</h2>
          <p className="mt-2 text-[15px] leading-7">{shown.exceptionWhy || shown.interventionWhy}</p>
          {shown.exception === 'address' ? (
            <div className="mt-4 border-2 border-ink bg-hl/50 p-3">
              <p className="eyebrow">Reply</p>
              <p className="mt-2 text-[15px] leading-7">{shown.addressReply || 'Reply stored.'}</p>
            </div>
          ) : null}
          {answered ? null : (
            <div className="mt-4 flex flex-wrap gap-2" data-tour="exception-action">
              {shown.exception === 'address' ? (
                <Button type="button" disabled={Boolean(saving)} onClick={() => { void useReply(); }}>
                  {saving === 'address' ? 'Saving…' : 'Use this'}
                </Button>
              ) : null}
              <Button type="button" disabled={Boolean(saving) || shown.stage === 'closed'} onClick={() => { void mark('confirmed'); }}>Confirm</Button>
              <Button type="button" tone="danger" disabled={Boolean(saving) || shown.stage === 'closed'} onClick={() => setConfirmCancel(true)}>Cancel</Button>
              <Link href={`/app/orders/${shown.id}`} className="btn-ghost !px-3 !py-2 !text-[11px]">Open</Link>
            </div>
          )}
          {answered ? <div className="mt-4" data-tour="exception-action" /> : null}
          {shown.stage === 'closed' && !answered ? null : (
            <div className="mt-4">
              {shown.stage === 'closed' ? null : (
                <Button type="button" tone="ghost" onClick={() => { void pin(); }}>Check pincode</Button>
              )}
              {me.isSuccess && shown.stage !== 'closed' ? (
                <div className="mt-3">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-inksoft" data-autopilot-calls>
                    {autopilotCallLine(shown)}
                  </p>
                  {demo ? (
                    <div className="mt-2">
                      <div className="flex flex-wrap items-start gap-2">
                        <Button
                          type="button"
                          tone="ghost"
                          className="!h-auto !whitespace-normal !px-3 !py-2 !text-left !text-[12px] !normal-case !leading-5 !tracking-normal"
                          data-tour="demo-call"
                          disabled={!callsLeft}
                          onClick={() => {
                            baseline.current = (shown.timeline || []).length;
                            remember();
                            setCallOpen(true);
                          }}
                        >
                          {DEMO_CALL_LABEL}
                        </Button>
                        <Button type="button" tone="ghost" className="!px-3 !py-2 !text-[11px]" onClick={resetDemoCall}>
                          {RESET_CALL_LABEL}
                        </Button>
                      </div>
                      {callBudget?.applies ? (
                        <p className="mt-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-inksoft" data-demo-calls>
                          {demoCallBudgetLine(callBudget)}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <Button
                        type="button"
                        tone="ghost"
                        className="mt-2"
                        data-tour="try-one-more-call"
                        disabled={used || calling}
                        aria-describedby={used ? 'extra-call-reason' : undefined}
                        onClick={() => { void tryOneMore(); }}
                      >
                        {calling ? 'Calling…' : EXTRA_CALL_LABEL}
                      </Button>
                      {used && shown.extraCall?.outcome !== 'calling' ? (
                        <p id="extra-call-reason" className="mt-2 text-sm leading-6">{EXTRA_CALL_USED}</p>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>
          )}
          {demo && callOpen && shown.stage !== 'closed' ? (
            <div className="mt-4">
              <CallBuyer
              key={callEpoch}
              orderId={shown.id}
              open
              label={DEMO_CALL_LABEL}
              canStart={callsLeft}
              onClose={() => setCallOpen(false)}
              onPlan={onDemoPlan}
              onSettled={() => setBudgetTick((current) => current + 1)}
            />
            </div>
          ) : null}
          {result ? <div ref={resultRef}><CallResultBox result={result} /></div> : null}
          {pinState ? <PincodeCheck status={pinState.status} view={pinState.view} /> : null}
          <ol className="mt-5 space-y-2">
            {(shown.timeline || []).slice(-4).map((step) => (
              <li key={`${step.at}-${step.step}`} className="border-2 border-ink/30 px-3 py-2">
                <p className="font-mono text-[11px] font-bold uppercase">{step.step.replaceAll('_', ' ')}</p>
                <p className="text-sm leading-6">{step.detail}</p>
              </li>
            ))}
          </ol>
          <div className="mt-4">
            <MessageThread status={shown.whatsappStatus} conversation={shown.conversation} />
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
