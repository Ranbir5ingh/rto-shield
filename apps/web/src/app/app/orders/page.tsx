'use client';

import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { CsvImporter } from '@/components/CsvImporter';
import { useToast } from '@/components/Toaster';
import { actionCopy } from '@/components/OrderActions';
import { Button, Dropdown, Field, Page, Pager, RiskBadge, Section, Skeleton, inputClass } from '@/components/ui';
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

  const scoring = phase === 'fast' || phase === 'upgrade';

  return (
    <Page
      eyebrow="/ Scanner"
      title="Score pending orders"
      sub="Low scores can ship straight away. Medium and High go to the confirmation queue."
      actions={
        <Button type="button" onClick={score} disabled={scoring}>
          {phase === 'fast' ? 'Fast pass…' : phase === 'upgrade' ? 'Upgrading the full model…' : 'Score pending orders'}
        </Button>
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
        <div id="scanner-list" className={`mt-4 border-t-2 border-ink ${list.isFetching && !list.isLoading ? 'opacity-80' : ''}`}>
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
            <p className="px-5 py-10 text-center font-mono text-xs font-bold uppercase leading-6 tracking-[0.16em] text-inksoft sm:px-6">
              No pending orders yet.<br />Add one below or connect Shopify.
            </p>
          ) : null}
        </div>
        <div className="border-t-2 border-ink px-5 py-3 sm:px-6">
          <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <Section eyebrow="Manual entry" title="Add an order">
          <form onSubmit={createOrder} className="grid gap-4 sm:grid-cols-2">
            <Field label="Buyer name">
              <input className={inputClass} value={form.buyerName} onChange={(event) => set('buyerName', event.target.value)} required />
            </Field>
            <Field label="Phone">
              <input className={inputClass} value={form.phone} onChange={(event) => set('phone', event.target.value)} required />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address">
                <input className={inputClass} value={form.address} onChange={(event) => set('address', event.target.value)} required />
              </Field>
            </div>
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
            <div className="sm:col-span-2">
              <Button type="submit">Add pending order</Button>
            </div>
          </form>
        </Section>
        <Section eyebrow="Bulk import" title="Upload a CSV">
          <p className="-mt-2 mb-4 text-sm leading-6 text-ink/70">
            A Shopify export, a Meesho-style file, or the generic template. Columns are matched automatically.
          </p>
          <CsvImporter mode="pending" onImported={refresh} />
        </Section>
      </div>
    </Page>
  );
}
