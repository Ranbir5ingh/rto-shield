'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';

export function DemoButton({ className = '', label = 'Open the demo shop' }: { className?: string; label?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function open() {
    setPending(true);
    setError('');
    try {
      await api('/auth/demo', { method: 'POST' });
      router.push('/app');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The demo shop did not open. Try again in a moment.');
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={open} disabled={pending} data-magnetic className={`btn btn-primary disabled:opacity-60 ${className}`}>
        {pending ? 'Opening Asha Studio…' : label}
      </button>
      {error ? <p className="mt-2 text-sm text-high">{error}</p> : null}
    </div>
  );
}
