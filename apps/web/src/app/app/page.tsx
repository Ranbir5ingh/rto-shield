'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Distribution, TrendChart } from '@/components/Charts';
import { Skeleton } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { inr, predictorLabel } from '@/lib/format';
import type { DashboardData } from '@/lib/types';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<DashboardData>('/dashboard')
      .then(setData)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load the dashboard'));
  }, []);

  if (error) return <p className="text-danger">{error}</p>;
  if (!data) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading the shop">
        <Skeleton className="h-12 w-56" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const cards = [
    ['RTO rate', data.rtoRate === null ? '—' : `${data.rtoRate}%`, `${data.rto} returned · ${data.delivered} delivered`],
    ['₹ saved estimate', inr(data.savedInr), `${data.prevented} risky orders cancelled × ${inr(data.rtoCostInr)}`],
    ['High-risk still pending', String(data.highPending), `${inr(data.exposureInr)} if they all come back`],
    ['Orders on file', String(data.counts.history + data.counts.pending + data.counts.closed), `${data.counts.pending} waiting to ship`],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Shop</p>
          <h1 className="mt-2 font-medium text-display-2">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Saved rupees are cancelled Medium and High orders times your cost per RTO. It is an estimate, not a bank balance.
          </p>
        </div>
        <Link href="/app/history" className="pill pill-dark">
          Add history
        </Link>
      </div>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value, hint]) => (
          <article key={label} className="card p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
            <p className="mt-3 font-mono text-3xl tracking-tight tabular-nums">{value}</p>
            <p className="mt-2 text-xs leading-5 text-muted">{hint}</p>
          </article>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-5">
        <article className="panel p-5 shadow-card lg:col-span-3">
          <h2 className="font-semibold">RTO rate by week</h2>
          <div className="mt-3">
            <TrendChart points={data.trend} />
          </div>
        </article>
        <article className="panel p-5 shadow-card lg:col-span-2">
          <h2 className="font-semibold">Pending risk</h2>
          <div className="mt-4">
            <Distribution bands={data.distribution} />
          </div>
        </article>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel p-5 shadow-card">
          <h2 className="font-semibold">Top reasons</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.topReasons.length ? (
              data.topReasons.map((reason) => (
                <li key={reason.reason} className="flex justify-between gap-4">
                  <span>{reason.reason}</span>
                  <span className="tabular-nums text-ink/60">{reason.count}</span>
                </li>
              ))
            ) : (
              <li className="text-ink/60">Score pending orders to see why they look risky.</li>
            )}
          </ul>
        </article>
        <article className="panel p-5 shadow-card">
          <h2 className="font-semibold">Latest model check</h2>
          {data.model ? (
            <div className="mt-3 space-y-2 text-sm leading-6">
              <p>
                Predictor: <strong>{predictorLabel(data.model.model)}</strong>
              </p>
              <p className="text-ink/70">{data.model.modelLabel}</p>
              <p>
                Held-out AUC {data.model.metrics?.auc ?? '—'} · precision in the riskiest 10%{' '}
                {data.model.metrics?.precision_at_top_10pct ?? '—'}
              </p>
              <p className="text-ink/60">
                Train {data.model.metrics?.n_train ?? '—'} / test {data.model.metrics?.n_test ?? '—'} · address notes from{' '}
                {data.model.addressSource}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink/60">No score yet. History plus pending orders produces the first metric.</p>
          )}
        </article>
      </section>
    </div>
  );
}
