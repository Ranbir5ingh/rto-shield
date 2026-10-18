'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useToast } from '@/components/Toaster';
import { Page, Skeleton } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useActivity } from '@/lib/queries';

export default function HistoryPage() {
  const toast = useToast();
  const activity = useActivity();
  const events = activity.data?.events ?? [];

  useEffect(() => {
    if (activity.isError) toast.error(activity.error instanceof ApiError ? activity.error.message : 'Could not load activity');
  }, [activity.isError, activity.error, toast]);

  return (
    <Page eyebrow="/ Activity" title="Activity" sub="What the shop did. Uploads stay on the start page.">
      <div data-tour="activity" data-tour-ready={activity.isSuccess || activity.isError ? 'true' : 'false'} className="space-y-3">
        {!activity.data && activity.isLoading ? <Skeleton className="h-24" /> : null}
        {events.map((event) => (
          <article key={`${event.orderId}-${event.at}-${event.step}`} className="border-2 border-ink bg-paper px-4 py-3 shadow-[3px_3px_0_0_#1B1712]">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">{event.step.replaceAll('_', ' ')}</p>
            <p className="mt-1 text-[15px] leading-7">{event.detail}</p>
            <Link href={`/app/orders/${event.orderId}`} className="mt-2 inline-block font-mono text-[11px] font-bold uppercase tracking-[0.12em] underline decoration-lime decoration-2 underline-offset-4">
              {event.externalOrderId}
            </Link>
          </article>
        ))}
        {(activity.isSuccess || activity.isError) && !events.length ? (
          <p className="border-2 border-ink bg-paper px-4 py-6 text-[15px] leading-7">No steps yet. Score a batch and the log fills in.</p>
        ) : null}
      </div>
    </Page>
  );
}
