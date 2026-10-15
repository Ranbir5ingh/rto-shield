'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CsvImporter } from '@/components/CsvImporter';
import { Button, Field, Notice, RiskBadge, Skeleton, inputClass } from '@/components/ui';
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
  const [pending, setPending] = useState(false);
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
    setPending(true);
    setError('');
    try {
      const result = await api<{ scored: number; modelLabel: string; warnings: string[] }>('/orders/score', { method: 'POST' });
      setInfo(`Scored ${result.scored}. ${result.modelLabel || ''} ${(result.warnings || []).join(' ')}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Scoring failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-medium text-display-2">Score pending orders</h1>
          <p className="mt-2 text-sm text-ink/70">Low scores can ship. Medium and High go to the confirmation queue.</p>
        </div>
        <Button type="button" onClick={score} disabled={pending}>
          {pending ? 'Scoring…' : 'Score pending orders'}
        </Button>
      </div>
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
          <select className={inputClass} value={form.paymentType} onChange={(event) => set('paymentType', event.target.value)}>
            <option value="cod">Cash on delivery</option>
            <option value="prepaid">Prepaid</option>
          </select>
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
              <th>Why</th>
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
