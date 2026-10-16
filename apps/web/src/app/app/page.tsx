'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Distribution, TrendChart } from '@/components/Charts';
import { Eyebrow, Flag, Skeleton, Stat } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { inr, predictorLabel } from '@/lib/format';
import type { DashboardData, OrderSummary } from '@/lib/types';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [wire, setWire] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<DashboardData>('/dashboard')
      .then(setData)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load the dashboard'));
    api<{ orders: OrderSummary[] }>('/orders?stage=pending&limit=100')
      .then((b) => setWire(b.orders.filter((o) => o.riskScore !== null).slice(0, 6)))
      .catch(() => setWire([]));
  }, []);

  if (error) return <p className="text-signal">{error}</p>;
  if (!data) {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Loading the shop">
        <Skeleton className="h-12 w-56" />
        <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8">
        <div>
          <Eyebrow>/Shop overview/</Eyebrow>
          <h1 className="statement mt-4 text-[clamp(2.2rem,5vw,4rem)]">
            Risk, made<br />legible.
          </h1>
        </div>
        <Link href="/app/history" className="btn-go !px-6 !py-3.5 !text-[11px]">
          + Add history <ArrowUpRight size={14} />
        </Link>
      </div>

      <section aria-label="Key metrics" className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-black py-8 pr-8">
          <Stat
            label="RTO rate"
            value={data.rtoRate === null ? '—' : `${data.rtoRate}%`}
            hint={`${data.rto} returned · ${data.delivered} delivered`}
          />
        </div>
        <div className="bg-black py-8 pr-8 lg:pl-8">
          <Stat
            label="₹ saved estimate"
            value={inr(data.savedInr)}
            hint={`${data.prevented} risky orders cancelled`}
          />
        </div>
        <div className="bg-black py-8 pr-8 lg:pl-8">
          <Stat
            label="High-risk pending"
            value={String(data.highPending)}
            hint={`${inr(data.exposureInr)} exposure if they all return`}
          />
        </div>
        <div className="bg-black py-8 lg:pl-8">
          <Stat
            label="Orders on file"
            value={String(data.counts.history + data.counts.pending + data.counts.closed)}
            hint={`${data.counts.pending} waiting to ship`}
          />
        </div>
      </section>

      <section className="grid gap-px bg-line lg:grid-cols-5">
        <div className="bg-black py-10 pr-0 lg:col-span-3 lg:pr-10">
          <div className="flex items-center justify-between">
            <Eyebrow>RTO rate by week</Eyebrow>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Lower is better</span>
          </div>
          <div className="mt-6">
            <TrendChart points={data.trend} />
          </div>
        </div>
        <div className="bg-black py-10 lg:col-span-2 lg:pl-10">
          <Eyebrow>Pending risk</Eyebrow>
          <div className="mt-6">
            <Distribution bands={data.distribution} />
          </div>
        </div>
      </section>

      <section className="grid gap-px bg-line lg:grid-cols-5">
        <div className="bg-black py-10 pr-0 lg:col-span-3 lg:pr-10">
          <div className="flex items-center justify-between">
            <Eyebrow>
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-go align-middle" />
              Live wire
            </Eyebrow>
            <Link href="/app/queue" className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.18em] text-go transition hover:brightness-125">
              Queue <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="mt-4">
            {(wire ?? []).map((o) => (
              <div key={o.id} className="datarow">
                <Link href={`/app/orders/${o.id}`} className="text-white/80 transition hover:text-go">
                  {o.externalOrderId || o.id.slice(-6)} · {o.city} · ₹{o.orderValue.toLocaleString('en-IN')}
                </Link>
                <span className="flex items-center gap-4">
                  {o.riskBand === 'High' ? <Flag tone="red">RTO risk</Flag> : o.riskBand === 'Medium' ? <Flag tone="banana">Watch</Flag> : <Flag tone="go">Clear</Flag>}
                  <span className="font-display text-xl font-extrabold tabular-nums">{o.riskScore}</span>
                </span>
              </div>
            ))}
            {wire !== null && !wire.length && (
              <p className="py-6 font-mono text-xs uppercase tracking-[0.18em] text-muted">No scored orders yet — score a batch to light up the wire.</p>
            )}
            {wire === null && <Skeleton className="h-10" />}
          </div>
        </div>
        <div className="bg-black py-10 lg:col-span-2 lg:pl-10">
          <Eyebrow>Model check</Eyebrow>
          {data.model ? (
            <div className="mt-6 space-y-3 font-mono text-xs leading-6">
              <p>
                <span className="uppercase tracking-[0.2em] text-muted">Predictor</span>{' '}
                <strong className="uppercase tracking-[0.1em] text-go">{predictorLabel(data.model.model)}</strong>
              </p>
              <p className="text-white/70">{data.model.modelLabel}</p>
              <p className="uppercase tracking-[0.1em] text-muted">
                AUC {data.model.metrics?.auc ?? '—'} · P@10% {data.model.metrics?.precision_at_top_10pct ?? '—'} · train {data.model.metrics?.n_train ?? '—'} / test {data.model.metrics?.n_test ?? '—'}
              </p>
            </div>
          ) : (
            <p className="mt-6 font-mono text-xs uppercase leading-6 tracking-[0.14em] text-muted">No score yet. History plus pending orders produces the first metric.</p>
          )}
        </div>
      </section>

      <section className="border-t border-line py-10">
        <Eyebrow>Top reasons</Eyebrow>
        <div className="mt-6">
          {data.topReasons.length ? (
            data.topReasons.map((reason, i) => (
              <div key={reason.reason} className="datarow">
                <span className="text-white/80">
                  <span className="mr-4 font-mono text-[11px] tracking-[0.2em] text-signal">{String(i + 1).padStart(2, '0')}</span>
                  {reason.reason}
                </span>
                <span className="font-mono text-sm tabular-nums text-muted">{reason.count}</span>
              </div>
            ))
          ) : (
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Score pending orders to see why they look risky.</p>
          )}
        </div>
        <p className="mt-10 font-mono text-[11px] leading-6 tracking-[0.08em] text-muted/70">
          SAVED RUPEES ARE CANCELLED MEDIUM AND HIGH ORDERS × YOUR COST PER RTO — AN ESTIMATE, NOT A BANK BALANCE.
        </p>
      </section>
    </div>
  );
}
