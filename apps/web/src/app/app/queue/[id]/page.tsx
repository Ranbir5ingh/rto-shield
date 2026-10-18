'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ExceptionPanel, ExceptionRow } from '@/components/ExceptionPanel';
import { useToast } from '@/components/Toaster';
import { Page, Skeleton } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useOrder, useQueue } from '@/lib/queries';

export default function ExceptionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || '';
  const toast = useToast();
  const router = useRouter();
  const queue = useQueue('action');
  const orderQuery = useOrder(id);
  const orders = queue.data?.orders ?? [];
  const order = orderQuery.data ?? orders.find((item) => item.id === id) ?? null;
  const ready = orderQuery.isSuccess || orderQuery.isError || queue.isSuccess || queue.isError;

  useEffect(() => {
    if (orderQuery.isError) toast.error(orderQuery.error instanceof ApiError ? orderQuery.error.message : 'Could not open this exception');
  }, [orderQuery.isError, orderQuery.error, toast]);

  return (
    <Page
      eyebrow="/ Exceptions"
      title={order?.buyerName || 'Exception'}
      sub={order ? order.exceptionWhy || order.interventionWhy || 'Orders that stopped.' : 'This exception did not open.'}
    >
      <Link href="/app/queue" className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] underline decoration-lime decoration-2 underline-offset-4">
        ← Exceptions
      </Link>
      <div className="lg:hidden" data-tour-ready={ready ? 'true' : 'false'}>
        {order || ready ? <ExceptionPanel order={order} /> : <Skeleton className="h-40" />}
      </div>
      <div className="hidden gap-4 lg:grid lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]" data-tour-ready={ready ? 'true' : 'false'}>
        <ul className="space-y-2" aria-label="Exceptions">
          {orders.map((item) => (
            <ExceptionRow key={item.id} order={item} selected={item.id === id} onSelect={(next) => router.replace(`/app/queue?order=${next}`)} />
          ))}
        </ul>
        {order || ready ? <ExceptionPanel order={order} /> : <Skeleton className="h-40" />}
      </div>
    </Page>
  );
}
