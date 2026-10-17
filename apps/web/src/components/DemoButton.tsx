'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/Toaster';
import { ApiError, api } from '@/lib/api';

export function DemoButton({ className = '', label = 'Try the demo' }: { className?: string; label?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function open() {
    setPending(true);
    try {
      await api('/demo/session', { method: 'POST' });
      router.push('/app');
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        try {
          await api('/auth/demo', { method: 'POST' });
          router.push('/app');
          return;
        } catch (fallback) {
          toast.error(fallback instanceof ApiError ? fallback.message : 'The demo shop did not open. Try again in a moment.');
        }
      } else {
        toast.error(err instanceof ApiError ? err.message : 'The demo shop did not open. Try again in a moment.');
      }
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={open} disabled={pending} data-magnetic className={`btn-go disabled:opacity-60 ${className}`}>
        {pending ? 'Opening the demo…' : label}
      </button>
    </div>
  );
}
