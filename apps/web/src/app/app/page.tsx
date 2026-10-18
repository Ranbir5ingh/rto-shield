'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { useToast } from '@/components/Toaster';
import { Page, Section, Skeleton, Stat } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { inr } from '@/lib/format';
import { useDashboard } from '@/lib/queries';

export default function DashboardPage() {
  const toast = useToast();
  const dash = useDashboard();
  const data = dash.data ?? null;
  const animated = useRef(false);

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
    toast.error(err instanceof ApiError ? err.message : 'Could not load results');
  }, [dash.isError, dash.data, dash.error, toast]);

  if (dash.isError && !data) {
    return (
      <Page eyebrow="/ Results" title="Results">
        <p className="text-sm text-ink/70">The shop did not load.</p>
      </Page>
    );
  }
  if (!data) {
    return (
      <Page eyebrow="/ Results" title="Results">
        <div className="space-y-8" aria-busy="true" aria-label="Loading results" data-tour-ready="false">
          <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        </div>
      </Page>
    );
  }

  const exceptions = data.actionToday ?? 0;
  const impact = data.impact;

  return (
    <Page
      eyebrow="/ Results"
      title="Results"
      sub="What the shop saved. Autopilot keeps the rest moving."
    >
      <div data-tour-ready="true" data-tour="results-home" className="space-y-6 lg:space-y-8">
        <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          <div data-reveal="pop">
            <Stat label="RTO cost" value={inr(data.rtoCostInr)} hint="What one return costs this shop" />
          </div>
          <div data-reveal="pop" data-delay="0.08">
            <Stat label="₹ prevented" value={inr(impact?.preventedInr || data.savedInr || 0)} hint="Converted and cancelled risky orders" />
          </div>
          <div data-reveal="pop" data-delay="0.16">
            <Stat label="RTO rate" value={data.rtoRate === null ? '—' : `${data.rtoRate}%`} hint={`${data.rto} returned · ${data.delivered} delivered`} />
          </div>
          <div data-reveal="pop" data-delay="0.24">
            <Link href="/app/queue" className="block h-full">
              <Stat label="Exceptions" value={String(exceptions)} hint="Orders that stopped and need you" />
            </Link>
          </div>
        </section>

        <Section eyebrow="Impact so far" title="What the shield caught" pad={false}>
          <div className="mt-5 grid grid-cols-2 gap-px border-t-2 border-ink bg-ink/15 lg:grid-cols-4" data-tour="impact">
            {[
              ['RTO prevented', inr(impact?.preventedInr || 0), 'Converted and cancelled risky orders, plus shipping'],
              ['Conversions', String(impact?.conversions || 0), 'COD orders paid as prepaid'],
              ['Address fixes', String(impact?.addressFixes || 0), 'Addresses checked and written back'],
              ['Confirmations', String(impact?.confirmations || 0), 'Orders confirmed before they shipped'],
            ].map(([label, value, hint]) => (
              <div key={label} className="bg-white px-5 py-5 sm:px-6">
                <p className="eyebrow">{label}</p>
                <p className="mt-2 font-display text-3xl font-black tabular-nums tracking-tight lg:text-4xl">{value}</p>
                <p className="mt-1.5 font-mono text-[11px] leading-5 text-inksoft">{hint}</p>
              </div>
            ))}
          </div>
        </Section>

        {exceptions > 0 ? (
          <Link href="/app/queue" className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] underline decoration-lime decoration-2 underline-offset-4">
            {exceptions} exception{exceptions === 1 ? '' : 's'} <ArrowRight size={14} />
          </Link>
        ) : (
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-inksoft">No exceptions. The shop is running.</p>
        )}
      </div>
    </Page>
  );
}
