'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { ExceptionPanel, ExceptionRow } from '@/components/ExceptionPanel';
import { useToast } from '@/components/Toaster';
import { Page, Skeleton } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useOrder, useQueue } from '@/lib/queries';

export default function QueuePage() {
  return (
    <Suspense fallback={<QueueSkeleton />}>
      <QueueScreen />
    </Suspense>
  );
}

function QueueSkeleton() {
  return (
    <Page eyebrow="/ Exceptions" title="Exceptions">
      <div className="space-y-4" aria-busy="true" aria-label="Loading exceptions">
        <Skeleton className="h-24" />
      </div>
    </Page>
  );
}

function QueueScreen() {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const queue = useQueue('action');
  const orders = queue.data?.orders ?? [];
  const paramId = params?.get('order') || '';
  const selectedId = paramId || orders[0]?.id || '';
  const listed = orders.find((order) => order.id === selectedId) || null;
  const dropped = useOrder(paramId && (queue.isSuccess || queue.isError) && !listed ? paramId : '');
  const selected = listed || dropped.data || null;
  const ready = queue.isSuccess || queue.isError;

  useEffect(() => {
    if (queue.isError) toast.error(queue.error instanceof ApiError ? queue.error.message : 'Could not load exceptions');
  }, [queue.isError, queue.error, toast]);

  function open(id: string) {
    router.replace(`/app/queue?order=${id}`);
  }

  return (
    <Page
      eyebrow="/ Exceptions"
      title="Exceptions"
      sub="Orders that stopped. Everything else is already moving."
    >
      <div data-tour-ready={ready ? 'true' : 'false'} className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <ul className="space-y-2" data-tour="exceptions" aria-label="Exceptions">
          {orders.map((order) => (
            <ExceptionRow key={order.id} order={order} selected={order.id === selected?.id} onSelect={open} />
          ))}
          {!orders.length && ready ? (
            <li className="border-2 border-ink bg-paper px-4 py-6 shadow-[3px_3px_0_0_#1B1712]">
              <p className="font-display text-xl font-black uppercase">The shop is running</p>
              <p className="mt-2 text-sm leading-6 text-ink/70">Nothing stopped. Autopilot is talking to buyers.</p>
            </li>
          ) : null}
        </ul>
        <div className="hidden lg:block">
          <ExceptionPanel order={ready ? selected : null} />
        </div>
      </div>
      {!orders.length && ready ? (
        <div className="lg:hidden">
          <ExceptionPanel order={null} />
        </div>
      ) : null}
    </Page>
  );
}
