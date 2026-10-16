'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, TrendingDown } from 'lucide-react';
import { Distribution, TrendChart } from '@/components/Charts';
import { RiskBadge, Skeleton } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { inr, predictorLabel } from '@/lib/format';
import type { DashboardData, OrderSummary } from '@/lib/types';

function Spark({ values, stroke = '#e8b34a' }: { values: (number | null)[]; stroke?: string }) {
  const pts = values.filter((v): v is number => v !== null);
  if (pts.length < 2) return null;
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const span = max - min || 1;
  const w = 120;
  const h = 36;
  const d = pts.map((v, i) => `${(i / (pts.length - 1)) * w},${h - ((v - min) / span) * (h - 6) - 3}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-28" aria-hidden="true">
      <polyline points={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" className="chart-line" pathLength={1} />
    </svg>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

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

  if (error) return <p className="text-danger">{error}</p>;
  if (!data) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading the shop">
        <Skeleton className="h-12 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const kpis: [string, string, string, (number | null)[], string][] = [
    ['RTO rate', data.rtoRate === null ? '—' : `${data.rtoRate}%`, `${data.rto} returned · ${data.delivered} delivered`, data.trend.map((t) => t.rate), '#ff5252'],
    ['₹ saved estimate', inr(data.savedInr), `${data.prevented} risky orders cancelled`, data.trend.map((t) => (t.rate === null ? null : 100 - t.rate)), '#e8b34a'],
    ['High-risk pending', String(data.highPending), `${inr(data.exposureInr)} exposure if they all return`, [], '#f5c65c'],
    ['Orders on file', String(data.counts.history + data.counts.pending + data.counts.closed), `${data.counts.pending} waiting to ship`, [], '#8ecae6'],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-muted">
            <span className="live-dot" /> {greeting().toUpperCase()} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
          </p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Mission <em className="accent-serif font-normal text-gold">control.</em>
          </h1>
        </div>
        <Link href="/app/history" className="pill pill-dark">
          + Add history
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(([label, value, hint, spark, stroke]) => (
          <article key={label} className="card spotlight group p-6">
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{label}</p>
              <Spark values={spark} stroke={stroke} />
            </div>
            <p className="mt-2 font-display text-4xl font-extrabold tabular-nums tracking-tight">{value}</p>
            <p className="mt-2 font-mono text-xs leading-5 text-muted">{hint}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <article className="card p-6 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
              <TrendingDown size={18} className="text-gold" /> RTO rate by week
            </h2>
            <span className="font-mono text-xs text-muted">LOWER IS BETTER</span>
          </div>
          <div className="mt-4">
            <TrendChart points={data.trend} />
          </div>
        </article>

        <div className="space-y-4 lg:col-span-2">
          <article className="card p-6">
            <h2 className="font-display text-xl font-bold tracking-tight">Pending risk</h2>
            <div className="mt-4">
              <Distribution bands={data.distribution} />
            </div>
          </article>
          <article className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
                <span className="live-dot" /> Live wire
              </h2>
              <Link href="/app/queue" className="flex items-center gap-1 font-mono text-xs text-gold transition hover:brightness-125">
                QUEUE <ArrowUpRight size={13} />
              </Link>
            </div>
            <ul className="mt-4 divide-y divide-white/6">
              {(wire ?? []).map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2.5">
                  <Link href={`/app/orders/${o.id}`} className="font-mono text-xs text-ink/80 transition hover:text-gold">
                    {o.externalOrderId || o.id.slice(-6)}
                  </Link>
                  <span className="flex items-center gap-3">
                    <RiskBadge band={o.riskBand} />
                    <span className="font-display text-lg font-bold tabular-nums">{o.riskScore}</span>
                  </span>
                </li>
              ))}
              {wire !== null && !wire.length && (
                <li className="py-4 font-mono text-xs text-muted">No scored orders yet — score a batch to light up the wire.</li>
              )}
              {wire === null && (
                <li className="py-4"><Skeleton className="h-8" /></li>
              )}
            </ul>
          </article>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card p-6">
          <h2 className="font-display text-xl font-bold tracking-tight">Top reasons</h2>
          <ul className="mt-4 space-y-3">
            {data.topReasons.length ? (
              data.topReasons.map((reason, i) => (
                <li key={reason.reason} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-3 text-sm text-ink/85">
                    <span className="font-mono text-xs text-gold">{String(i + 1).padStart(2, '0')}</span>
                    {reason.reason}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-muted">{reason.count}</span>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted">Score pending orders to see why they look risky.</li>
            )}
          </ul>
        </article>
        <article className="card p-6">
          <h2 className="font-display text-xl font-bold tracking-tight">Model check</h2>
          {data.model ? (
            <div className="mt-4 space-y-2.5 font-mono text-sm leading-6">
              <p>
                <span className="text-muted">PREDICTOR</span> <strong className="text-gold">{predictorLabel(data.model.model)}</strong>
              </p>
              <p className="text-ink/75">{data.model.modelLabel}</p>
              <p className="text-muted">
                AUC {data.model.metrics?.auc ?? '—'} · P@10% {data.model.metrics?.precision_at_top_10pct ?? '—'} · train {data.model.metrics?.n_train ?? '—'} / test {data.model.metrics?.n_test ?? '—'}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">No score yet. History plus pending orders produces the first metric.</p>
          )}
        </article>
      </section>

      <p className="font-mono text-xs leading-5 text-muted/70">
        Saved rupees are cancelled Medium and High orders × your cost per RTO — an estimate, not a bank balance.
      </p>
    </div>
  );
}
