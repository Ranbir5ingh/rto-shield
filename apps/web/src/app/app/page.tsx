'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ArrowRight, ArrowUpRight, Plus } from 'lucide-react';
import gsap from 'gsap';
import { Distribution, TrendChart } from '@/components/Charts';
import { useToast } from '@/components/Toaster';
import { Flag, Page, Section, Skeleton, Stat } from '@/components/ui';
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

  if (dash.isError && !data) {
    return (
      <Page eyebrow="/ Shop overview" title="Shop overview">
        <p className="text-sm text-ink/70">The shop did not load.</p>
      </Page>
    );
  }
  if (!data) {
    return (
      <Page eyebrow="/ Shop overview" title="Shop overview">
        <div className="space-y-8" aria-busy="true" aria-label="Loading the shop" data-tour-ready="false">
          <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </Page>
    );
  }

  const wire = data.liveWire ?? [];
  const actionCount = data.actionToday ?? data.highPending ?? 0;

  return (
    <Page
      eyebrow="/ Shop overview"
      title="Shop overview"
      sub="Every pending order, scored. The risky ones are already waiting for a decision."
      actions={
        <>
          <Link href="/app/queue" className="btn-go !px-5 !py-3 !text-[11px]">
            Open queue <ArrowRight size={14} />
          </Link>
          <Link href="/app/history" className="btn-ghost !px-5 !py-3 !text-[11px]">
            <Plus size={14} /> Add history
          </Link>
        </>
      }
    >
      <div data-tour-ready="true" className="space-y-6 lg:space-y-8">
        {/* the one thing that matters today */}
        {actionCount > 0 ? (
          <Link
            href="/app/queue"
            className="sticker-hover flex flex-wrap items-center justify-between gap-4 border-2 border-ink bg-lime p-5 shadow-sticker sm:p-6"
            data-reveal="pop"
          >
            <div>
              <p className="eyebrow">Needs your decision</p>
              <p className="mt-2 font-display text-2xl font-black uppercase tracking-tight md:text-3xl">
                {actionCount} order{actionCount === 1 ? '' : 's'} · {inr(data.exposureInr)} at risk
              </p>
              <p className="mt-1 text-sm leading-6 text-ink/75">
                Confirm them on WhatsApp before they ship — or let them go.
              </p>
            </div>
            <span className="btn-ghost !bg-white">Review <ArrowRight size={14} /></span>
          </Link>
        ) : null}

        {/* key metrics */}
        <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          <div data-reveal="pop">
            <Stat label="Needs action" value={String(actionCount)} hint="Medium and high orders still open today" />
          </div>
          <div data-reveal="pop" data-delay="0.08">
            <Stat label="₹ at risk" value={inr(data.exposureInr)} hint="High-risk pending value plus shipping both ways" />
          </div>
          <div data-reveal="pop" data-delay="0.16">
            <Stat label="Confirmation rate" value={data.confirmationRate == null ? '—' : `${data.confirmationRate}%`} hint="Confirmed replies out of every decision" />
          </div>
          <div data-reveal="pop" data-delay="0.24">
            <Stat label="RTO rate" value={data.rtoRate === null ? '—' : `${data.rtoRate}%`} hint={`${data.rto} returned · ${data.delivered} delivered`} />
          </div>
        </section>

        {/* charts */}
        <section className="grid gap-4 lg:grid-cols-5 lg:gap-5">
          <div className="lg:col-span-3">
            <Section eyebrow="Trend · lower is better" title="RTO rate by week">
              <TrendChart points={data.trend} />
            </Section>
          </div>
          <div className="lg:col-span-2" data-tour="risk-scores">
            <Section eyebrow="Right now" title="Pending risk">
              <Distribution bands={data.distribution} />
            </Section>
          </div>
        </section>

        {/* wire + pincodes */}
        <section className="grid gap-4 lg:grid-cols-5 lg:gap-5">
          <div className="lg:col-span-3">
            <Section
              eyebrow="Live wire"
              title="Latest scores"
              action={
                <Link href="/app/queue" className="flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink underline decoration-lime decoration-2 underline-offset-4 transition hover:decoration-ink">
                  Queue <ArrowUpRight size={13} />
                </Link>
              }
              pad={false}
            >
              <div className="mt-4 px-5 sm:px-6 lg:px-7">
                <div className="hidden grid-cols-[4.5rem_5.5rem_1fr_auto] gap-3 border-b-2 border-ink pb-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-inksoft sm:grid">
                  <span>Score</span>
                  <span>Band</span>
                  <span>Order</span>
                  <span>Value</span>
                </div>
              </div>
              <div className="px-5 pb-5 sm:px-6 sm:pb-6 lg:px-7 lg:pb-7">
                {wire.map((o) => (
                  <Link key={o.id} href={`/app/orders/${o.id}`} className="grid grid-cols-[4.5rem_1fr] items-center gap-3 border-b border-ink/20 py-3 last:border-b-0 sm:grid-cols-[4.5rem_5.5rem_1fr_auto]">
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
            </Section>
          </div>
          <div className="lg:col-span-2">
            <Section eyebrow="Where it hurts" title="Your pincodes">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-inksoft">
                New buyers {data.buyers?.fresh ?? 0} · repeat {data.buyers?.repeat ?? 0}
              </p>
              <div className="mt-2">
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
            </Section>
          </div>
        </section>

        {/* impact */}
        <Section eyebrow="Impact so far" title="What the shield caught" pad={false}>
          <div className="mt-5 grid grid-cols-2 gap-px border-t-2 border-ink bg-ink/15 lg:grid-cols-4" data-tour="impact">
            {[
              ['RTO prevented', inr(data.impact?.preventedInr || 0), 'Converted and cancelled risky orders, plus shipping'],
              ['Conversions', String(data.impact?.conversions || 0), 'COD orders paid as prepaid'],
              ['Address fixes', String(data.impact?.addressFixes || 0), 'Landmarks and new addresses written back'],
              ['Confirmations', String(data.impact?.confirmations || 0), 'Orders confirmed before they shipped'],
            ].map(([label, value, hint]) => (
              <div key={label} className="bg-white px-5 py-5 sm:px-6">
                <p className="eyebrow">{label}</p>
                <p className="mt-2 font-display text-3xl font-black tabular-nums tracking-tight lg:text-4xl">{value}</p>
                <p className="mt-1.5 font-mono text-[11px] leading-5 text-inksoft">{hint}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* reasons */}
        <Section eyebrow="Patterns" title="Top risk reasons">
          <div>
            {data.topReasons.length ? (
              data.topReasons.map((reason, i) => (
                <div key={reason.reason} className="datarow">
                  <span className="font-bold">
                    <span className="mr-3 bg-risk px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-[0.2em] text-white">{String(i + 1).padStart(2, '0')}</span>
                    {reason.reason}
                  </span>
                  <span className="font-mono text-sm font-bold tabular-nums">{reason.count}</span>
                </div>
              ))
            ) : (
              <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-inksoft">Score pending orders to see why they look risky.</p>
            )}
          </div>
          <p className="mt-6 border-t-2 border-dashed border-ink/20 pt-4 font-mono text-[11px] font-bold leading-6 tracking-[0.06em] text-inksoft">
            ₹ AT RISK IS THE HIGH-RISK PENDING VALUE PLUS YOUR COST PER RTO (SHIPPING BOTH WAYS). AN ESTIMATE, NOT A BANK BALANCE.
          </p>
        </Section>
      </div>
    </Page>
  );
}
