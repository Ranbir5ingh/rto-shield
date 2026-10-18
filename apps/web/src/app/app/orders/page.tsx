'use client';

import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { useToast } from '@/components/Toaster';
import { actionCopy } from '@/components/OrderActions';
import { Button, Page, Pager, RiskBadge, Section, Skeleton } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { inr } from '@/lib/format';
import { invalidateShop, useOrders } from '@/lib/queries';

const PAGE = 12;

export default function OrdersPage() {
  const toast = useToast();
  const client = useQueryClient();
  const [page, setPage] = useState(0);
  const list = useOrders('pending', page * PAGE, PAGE);
  const orders = list.data?.orders ?? [];
  const total = list.data?.total ?? 0;
  const [phase, setPhase] = useState<'idle' | 'fast' | 'upgrade' | 'done'>('idle');

  useEffect(() => {
    if (list.isError && !list.data) toast.error(list.error instanceof ApiError ? list.error.message : 'Could not load orders');
  }, [list.isError, list.data, list.error, toast]);

  function refresh() {
    invalidateShop(client);
  }

  async function score() {
    setPhase('fast');
    toast.info('Scoring a fast pass. The full model follows.');
    try {
      const result = await api<{ scored: number; modelLabel: string; warnings: string[]; upgrading?: boolean }>('/orders/score', {
        method: 'POST',
      });
      toast.success(`Fast scores are in for ${result.scored} orders. ${result.modelLabel || ''}`.trim());
      refresh();
      if (!result.upgrading) {
        setPhase('done');
        return;
      }
      setPhase('upgrade');
      const started = Date.now();
      while (Date.now() - started < 55_000) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        const status = await api<{ upgrading: boolean; model: { modelLabel?: string; model?: string } | null }>('/orders/score-status');
        if (!status.upgrading) {
          setPhase('done');
          toast.success(`Full model is in. ${status.model?.modelLabel || ''}`.trim());
          refresh();
          return;
        }
      }
      setPhase('done');
      toast.info('Fast scores are ready. The full model is still catching up.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Scoring failed');
      setPhase('idle');
    }
  }

  const scoring = phase === 'fast' || phase === 'upgrade';

  return (
    <Page
      eyebrow="/ Orders"
      title="Score pending orders"
      sub="Low scores can ship straight away. Medium and High go to the confirmation queue."
      actions={
        <>
          <Link href="/app/orders/new" className="btn-ghost !px-5 !py-3 !text-[11px]">
            <Plus size={14} /> Add order
          </Link>
          <Link href="/app/orders/import" className="btn-ghost !px-5 !py-3 !text-[11px]">
            <Upload size={14} /> Upload CSV
          </Link>
          <Button type="button" onClick={score} disabled={scoring}>
            {phase === 'fast' ? 'Fast pass…' : phase === 'upgrade' ? 'Upgrading the full model…' : 'Score pending orders'}
          </Button>
        </>
      }
    >
      {scoring ? (
        <div className="sticker-sm p-4" role="progressbar" aria-valuetext={phase === 'fast' ? 'Fast pass' : 'Full model'}>
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">{phase === 'fast' ? 'Fast pass scoring…' : 'Full model upgrading…'}</p>
            <p className="font-mono text-[11px] font-bold text-inksoft">{phase === 'fast' ? '1/2' : '2/2'}</p>
          </div>
          <div className="mt-3 h-3 border-2 border-ink bg-paper">
            <div className={`h-full bg-hl transition-all ${phase === 'fast' ? 'w-1/3' : 'w-2/3'}`} />
          </div>
        </div>
      ) : null}

      <Section eyebrow={`Pending · ${total}`} title="Orders waiting for a score" pad={false}>
        <div id="pending-orders" className={`mt-4 border-t-2 border-ink ${list.isFetching && !list.isLoading ? 'opacity-80' : ''}`}>
          {list.isLoading ? <div className="p-5"><Skeleton className="h-48" /></div> : null}
          {orders.map((order) => (
            <article key={order.id} className="grid gap-4 border-b-2 border-ink/60 px-5 py-4 transition last:border-b-0 hover:bg-hl/20 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center sm:px-6">
              <div className="flex items-center gap-3 sm:block">
                <p className="font-display text-4xl font-black tabular-nums leading-none">{order.riskScore ?? '—'}</p>
                <div className="sm:mt-1.5"><RiskBadge band={order.riskBand} /></div>
              </div>
              <div className="min-w-0">
                <Link href={`/app/orders/${order.id}`} className="font-display text-lg font-extrabold uppercase tracking-tight underline decoration-lime decoration-2 underline-offset-4">
                  {order.externalOrderId}
                </Link>
                <p className="mt-1 text-sm text-ink/75">
                  {order.buyerName} · {order.city || '—'} · {order.pincode}
                </p>
                <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-inksoft">
                  {inr(order.orderValue)} · {order.paymentType === 'cod' ? 'COD' : 'Prepaid'} · {order.outcome || order.stage}
                </p>
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {(order.reasons.slice(0, 3).length ? order.reasons.slice(0, 3) : ['Not scored']).map((reason) => (
                    <li key={reason} className="border-2 border-ink bg-hl px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]">{reason}</li>
                  ))}
                </ul>
              </div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-inksoft sm:max-w-[10rem] sm:text-right">{actionCopy(order).label}</p>
            </article>
          ))}
          {list.isFetched && !orders.length ? (
            <div className="px-5 py-10 text-center sm:px-6">
              <p className="font-mono text-xs font-bold uppercase leading-6 tracking-[0.16em] text-inksoft">
                No pending orders yet.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                <Link href="/app/orders/new" className="btn-ghost !px-5 !py-3 !text-[11px]">
                  <Plus size={14} /> Add order
                </Link>
                <Link href="/app/orders/import" className="btn-ghost !px-5 !py-3 !text-[11px]">
                  <Upload size={14} /> Upload CSV
                </Link>
              </div>
            </div>
          ) : null}
        </div>
        <div className="border-t-2 border-ink px-5 py-3 sm:px-6">
          <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
        </div>
      </Section>
    </Page>
  );
}
