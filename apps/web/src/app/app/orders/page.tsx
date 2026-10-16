'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CsvImporter } from '@/components/CsvImporter';
import { Button, Dropdown, Field, Notice, RiskBadge, Skeleton, inputClass } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { inr } from '@/lib/format';
import type { OrderSummary } from '@/lib/types';

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

export default function OrdersPage() {
  const [form, setForm] = useState(empty);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [phase, setPhase] = useState<'idle' | 'fast' | 'upgrade' | 'done'>('idle');
  const [ready, setReady] = useState(false);

  async function load() {
    const body = await api<{ orders: OrderSummary[] }>('/orders?stage=pending&limit=100');
    setOrders(body.orders);
  }

  useEffect(() => {
    load()
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load orders'))
      .finally(() => setReady(true));
  }, []);

  function set<K extends keyof typeof empty>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createOrder(event: React.FormEvent) {
    event.preventDefault();
    setError('');
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
      setInfo('Order added. Score when the batch is ready.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the order');
    }
  }

  async function score() {
    setPhase('fast');
    setError('');
    setInfo('Scoring a fast pass. The full model follows.');
    try {
      const result = await api<{ scored: number; modelLabel: string; warnings: string[]; upgrading?: boolean }>('/orders/score', {
        method: 'POST',
      });
      setInfo(`Fast scores are in for ${result.scored} orders. ${result.modelLabel || ''}`.trim());
      await load();
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
          setInfo(`Full model is in. ${status.model?.modelLabel || ''}`.trim());
          await load();
          return;
        }
      }
      setPhase('done');
      setInfo('Fast scores are ready. The full model is still catching up.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Scoring failed');
      setPhase('idle');
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display font-medium text-display-2">Score pending orders</h1>
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
      {info ? <Notice tone="good">{info}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
      <form onSubmit={createOrder} className="panel grid gap-3 p-5 shadow-card md:grid-cols-2">
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
      <CsvImporter mode="pending" onImported={() => load()} />
      {!ready ? <Skeleton className="h-48" /> : null}
      <div className="panel overflow-x-auto shadow-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Buyer</th>
              <th>Value</th>
              <th>Score</th>
              <th>Top factors</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link href={`/app/orders/${order.id}`} className="font-medium underline-offset-2 hover:underline">
                    {order.externalOrderId}
                  </Link>
                  <div className="text-xs text-ink/50">{order.pincode} · {order.paymentType}</div>
                </td>
                <td className="py-3">
                  {order.buyerName}
                  <div className="text-xs text-ink/50">{order.phoneMasked}</div>
                </td>
                <td className="py-3">{inr(order.orderValue)}</td>
                <td className="py-3">
                  <RiskBadge band={order.riskBand} />
                  <div className="mt-1 tabular-nums">{order.riskScore ?? '—'}</div>
                </td>
                <td className="py-3 pr-3 text-ink/75">{order.reasons.join(' · ') || 'Not scored'}</td>
              </tr>
            ))}
            {ready && !orders.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-ink/60">
                  No pending orders yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
