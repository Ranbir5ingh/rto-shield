'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';
import gsap from 'gsap';
import { Distribution, TrendChart } from '@/components/Charts';
import { useToast } from '@/components/Toaster';
import { Eyebrow, Flag, Skeleton, Stat } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { inr } from '@/lib/format';
import { useDashboard } from '@/lib/queries';

export default function DashboardPage() {
  const toast = useToast();
  const dash = useDashboard();
  const data = dash.data ?? null;
  const animated = useRef(false);

  // Sticker pop-in for the stat cards once data lands.
  useEffect(() => {
    if (!data || animated.current) return;
    animated.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelectorAll<HTMLElement>('[data-reveal="pop"]').forEach((n) => {
      gsap.from(n, {
        scale: 0.5,
        rotation: -5,
        autoAlpha: 0,
        duration: 0.6,
        delay: Number(n.dataset.delay || 0),
        ease: 'back.out(1.7)',
        clearProps: 'transform,opacity,visibility',
      });
    });
  }, [data]);

  useEffect(() => {
    if (!dash.isError || dash.data) return;
    const err = dash.error;
    toast.error(err instanceof ApiError ? err.message : 'Could not load the dashboard');
  }, [dash.isError, dash.data, dash.error, toast]);

  if (dash.isError && !data) return <p className="text-sm text-ink/70">The shop did not load.</p>;
  if (!data) {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Loading the shop" data-tour-ready="false">
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

  const wire = data.liveWire ?? [];

  return (
    <div className="space-y-0" data-tour-ready="true">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b-2 border-ink pb-8">
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

      <section aria-label="Key metrics" className="grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
        <div data-reveal="pop">
          <Stat
            label="Needs action"
            value={String(data.actionToday ?? data.highPending)}
            hint="Medium and high orders still open today"
          />
        </div>
        <div data-reveal="pop" data-delay="0.08">
          <Stat
            label="₹ at risk"
            value={inr(data.exposureInr)}
            hint="High-risk pending value plus shipping both ways"
          />
        </div>
        <div data-reveal="pop" data-delay="0.16">
          <Stat
            label="Confirmation rate"
            value={data.confirmationRate == null ? '—' : `${data.confirmationRate}%`}
            hint="Confirmed replies out of every decision"
          />
        </div>
        <div data-reveal="pop" data-delay="0.24">
          <Stat
            label="RTO rate"
            value={data.rtoRate === null ? '—' : `${data.rtoRate}%`}
            hint={`${data.rto} returned · ${data.delivered} delivered`}
          />
        </div>
      </section>
      <section aria-label="Impact" data-tour="impact" className="grid gap-6 pb-8 sm:grid-cols-2 lg:grid-cols-4">
        <div data-reveal="pop">
          <Stat label="RTO prevented" value={inr(data.impact?.preventedInr || 0)} hint="Converted and cancelled risky orders, plus shipping" />
        </div>
        <div data-reveal="pop">
          <Stat label="Conversions" value={String(data.impact?.conversions || 0)} hint="Cash on delivery orders paid as prepaid" />
        </div>
        <div data-reveal="pop">
          <Stat label="Address fixes" value={String(data.impact?.addressFixes || 0)} hint="Landmarks and new addresses written back" />
        </div>
        <div data-reveal="pop">
          <Stat label="Confirmations" value={String(data.impact?.confirmations || 0)} hint="Orders confirmed before they shipped" />
        </div>
      </section>

      <section className="grid gap-6 py-4 lg:grid-cols-5">
        <div className="sticker relative p-6 sm:p-8 lg:col-span-3">
          <div className="flex items-center justify-between">
            <Eyebrow>RTO rate by week</Eyebrow>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-inksoft">Lower is better</span>
          </div>
          <div className="mt-6">
            <TrendChart points={data.trend} />
          </div>
        </div>
        <div className="sticker relative p-6 sm:p-8 lg:col-span-2" data-tour="risk-scores">
          <Eyebrow>Pending risk</Eyebrow>
          <div className="mt-6">
            <Distribution bands={data.distribution} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 py-4 lg:grid-cols-5">
        <div className="sticker relative p-6 sm:p-8 lg:col-span-3">
          <div className="flex items-center justify-between">
            <Eyebrow>
              <span className="mr-2 inline-block h-2 w-2 bg-lime align-middle" />
              Live wire
            </Eyebrow>
            <Link href="/app/queue" className="flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink underline decoration-lime decoration-2 underline-offset-4 transition hover:decoration-ink">
              Queue <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="mt-4">
            <div className="hidden grid-cols-[4.5rem_5.5rem_1fr_auto] gap-3 border-b-2 border-ink pb-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-inksoft sm:grid">
              <span>Score</span>
              <span>Band</span>
              <span>Order</span>
              <span>Value</span>
            </div>
            {wire.map((o) => (
              <Link key={o.id} href={`/app/orders/${o.id}`} className="grid grid-cols-[4.5rem_1fr] items-center gap-3 border-b border-ink/20 py-3 sm:grid-cols-[4.5rem_5.5rem_1fr_auto]">
                <span className="font-display text-2xl font-extrabold tabular-nums">{o.riskScore ?? '—'}</span>
                <span className="hidden sm:block">
                  {o.riskBand === 'High' ? <Flag tone="red">High</Flag> : o.riskBand === 'Medium' ? <Flag tone="banana">Medium</Flag> : <Flag tone="go">Low</Flag>}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold">{o.externalOrderId || o.id.slice(-6)}</span>
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-inksoft">{o.city}</span>
                </span>
                <span className="font-mono text-sm font-bold tabular-nums">{inr(o.orderValue)}</span>
              </Link>
            ))}
            {!wire.length && (
              <p className="py-6 font-mono text-xs font-bold uppercase tracking-[0.18em] text-inksoft">No scored orders yet — score a batch to light up the wire.</p>
            )}
          </div>
        </div>
        <div className="sticker relative p-6 sm:p-8 lg:col-span-2">
          <Eyebrow>Your pincodes</Eyebrow>
          <p className="mt-4 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-inksoft">
            New buyers {data.buyers?.fresh ?? 0} · repeat {data.buyers?.repeat ?? 0}
          </p>
          <div className="mt-4">
            {(data.pinInsights || []).map((pin) => (
              <div key={pin.pincode} className="datarow">
                <span className="font-bold">{pin.pincode}</span>
                <span className="font-mono text-xs font-bold tabular-nums">
                  {pin.rate}% · {pin.rto}/{pin.orders}
                </span>
              </div>
            ))}
            {!data.pinInsights?.length && (
              <p className="py-4 font-mono text-xs font-bold uppercase leading-6 tracking-[0.14em] text-inksoft">
                Synced outcomes will show which of your own pincodes come back.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="border-t-2 border-ink py-10">
        <Eyebrow>Top reasons</Eyebrow>
        <div className="mt-6">
          {data.topReasons.length ? (
            data.topReasons.map((reason, i) => (
              <div key={reason.reason} className="datarow">
                <span className="font-bold">
                  <span className="mr-4 bg-risk px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-[0.2em] text-white">{String(i + 1).padStart(2, '0')}</span>
                  {reason.reason}
                </span>
                <span className="font-mono text-sm font-bold tabular-nums">{reason.count}</span>
              </div>
            ))
          ) : (
            <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-inksoft">Score pending orders to see why they look risky.</p>
          )}
        </div>
        <p className="mt-10 font-mono text-[11px] font-bold leading-6 tracking-[0.08em] text-inksoft">
          ₹ AT RISK IS THE HIGH-RISK PENDING VALUE PLUS YOUR COST PER RTO (SHIPPING BOTH WAYS). AN ESTIMATE, NOT A BANK BALANCE.
        </p>
      </section>
    </div>
  );
}
