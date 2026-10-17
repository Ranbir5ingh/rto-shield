'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/Toaster';
import { ApiError, api } from '@/lib/api';

export function DemoButton({ className = '', label = 'Open the demo shop' }: { className?: string; label?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function open() {
    setPending(true);
    try {
      await api('/auth/demo', { method: 'POST' });
      router.push('/app');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'The demo shop did not open. Try again in a moment.');
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={open} disabled={pending} data-magnetic className={`btn-go disabled:opacity-60 ${className}`}>
        {pending ? 'Opening Asha Studio…' : label}
      </button>
    </div>
  );
}
