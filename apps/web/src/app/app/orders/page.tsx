'use client';

import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { CsvImporter } from '@/components/CsvImporter';
import { useToast } from '@/components/Toaster';
import { actionCopy } from '@/components/OrderActions';
import { Button, Dropdown, Field, Pager, RiskBadge, Skeleton, inputClass } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { inr } from '@/lib/format';
import { invalidateShop, useOrders } from '@/lib/queries';

const empty = {
  buyerName: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  orderValue: '799',
  paymentType: 'cod',
  priorOrders: '0',
  priorRtos: '0',
  productName: '',
};

const PAGE = 12;

export default function OrdersPage() {
  const [form, setForm] = useState(empty);
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

  function set<K extends keyof typeof empty>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createOrder(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api('/orders/manual', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          orderValue: Number(form.orderValue),
          priorOrders: Number(form.priorOrders),
          priorRtos: Number(form.priorRtos),
        }),
      });
      setForm(empty);
      toast.success('Order added. Score when the batch is ready.');
      refresh();
      document.getElementById('scanner-list')?.scrollIntoView({ block: 'start' });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not add the order');
    }
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[clamp(1.7rem,4vw,2.6rem)] font-black uppercase leading-none">Score pending orders</h1>
          <p className="mt-2 text-sm text-ink/70">Low scores can ship. Medium and High go to the confirmation queue.</p>
        </div>
        <Button type="button" onClick={score} disabled={phase === 'fast' || phase === 'upgrade'}>
          {phase === 'fast' ? 'Fast pass…' : phase === 'upgrade' ? 'Upgrading the full model…' : 'Score pending orders'}
        </Button>
      </div>
      {phase === 'fast' || phase === 'upgrade' ? (
        <div className="h-2 w-full border-2 border-ink bg-paper" role="progressbar" aria-valuetext={phase === 'fast' ? 'Fast pass' : 'Full model'}>
          <div className={`h-full bg-hl ${phase === 'fast' ? 'w-1/3' : 'w-2/3'}`} />
        </div>
      ) : null}
      {list.isLoading ? <Skeleton className="h-48" /> : null}
      <div id="scanner-list" className={`grid gap-3 ${list.isFetching && !list.isLoading ? 'opacity-80' : ''}`}>
        {orders.map((order) => (
          <article key={order.id} className="grid gap-3 border-2 border-ink bg-white p-3 sm:grid-cols-[4.5rem_1fr_auto] sm:items-center">
            <div className="flex items-center gap-2 sm:block">
              <p className="font-display text-4xl font-black tabular-nums leading-none">{order.riskScore ?? '—'}</p>
              <div className="mt-1"><RiskBadge band={order.riskBand} /></div>
            </div>
            <div className="min-w-0">
              <Link href={`/app/orders/${order.id}`} className="font-display text-xl font-extrabold uppercase underline decoration-lime decoration-2 underline-offset-4">
                {order.externalOrderId}
              </Link>
              <p className="mt-1 text-sm">
                {order.buyerName} · {order.city || '—'} · {order.pincode}
              </p>
              <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
                {inr(order.orderValue)} · {order.paymentType === 'cod' ? 'COD' : 'Prepaid'} · {order.outcome || order.stage}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {(order.reasons.slice(0, 3).length ? order.reasons.slice(0, 3) : ['Not scored']).map((reason) => (
                  <li key={reason} className="border-2 border-ink bg-hl px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em]">{reason}</li>
                ))}
              </ul>
            </div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] sm:text-right">{actionCopy(order).label}</p>
          </article>
        ))}
        {list.isFetched && !orders.length ? (
          <p className="border-2 border-ink bg-white px-4 py-8 font-mono text-xs font-bold uppercase tracking-[0.16em] text-inksoft">No pending orders yet.</p>
        ) : null}
      </div>
      <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
      <details className="border-2 border-ink bg-white">
        <summary className="cursor-pointer px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">Add an order</summary>
        <form onSubmit={createOrder} className="grid gap-3 border-t-2 border-ink p-4 md:grid-cols-2">
          <Field label="Buyer name">
            <input className={inputClass} value={form.buyerName} onChange={(event) => set('buyerName', event.target.value)} required />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={form.phone} onChange={(event) => set('phone', event.target.value)} required />
          </Field>
          <Field label="Address">
            <input className={inputClass} value={form.address} onChange={(event) => set('address', event.target.value)} required />
          </Field>
          <Field label="City">
            <input className={inputClass} value={form.city} onChange={(event) => set('city', event.target.value)} />
          </Field>
          <Field label="State">
            <input className={inputClass} value={form.state} onChange={(event) => set('state', event.target.value)} />
          </Field>
          <Field label="Pincode">
            <input className={inputClass} value={form.pincode} onChange={(event) => set('pincode', event.target.value)} required pattern="[1-9][0-9]{5}" />
          </Field>
          <Field label="Order value (₹)">
            <input className={inputClass} type="number" min={1} value={form.orderValue} onChange={(event) => set('orderValue', event.target.value)} required />
          </Field>
          <Field label="Payment">
            <Dropdown
              label="Payment"
              value={form.paymentType}
              onChange={(v) => set('paymentType', v)}
              options={[
                { value: 'cod', label: 'Cash on delivery' },
                { value: 'prepaid', label: 'Prepaid' },
              ]}
            />
          </Field>
          <Field label="Prior orders">
            <input className={inputClass} type="number" min={0} value={form.priorOrders} onChange={(event) => set('priorOrders', event.target.value)} />
          </Field>
          <Field label="Prior RTOs">
            <input className={inputClass} type="number" min={0} value={form.priorRtos} onChange={(event) => set('priorRtos', event.target.value)} />
          </Field>
          <div className="md:col-span-2">
            <Button type="submit">Add pending order</Button>
          </div>
        </form>
        <div className="border-t-2 border-ink p-4">
          <CsvImporter mode="pending" onImported={refresh} />
        </div>
      </details>
    </div>
  );
}
