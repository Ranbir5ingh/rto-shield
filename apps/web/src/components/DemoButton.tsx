'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '@/lib/api';

export function DemoButton({ className = '' }: { className?: string }) {
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
      <button
        type="button"
        onClick={open}
        disabled={pending}
        className={`pill pill-dark disabled:opacity-60 ${className}`}
      >
        {pending ? 'Opening Asha Studio…' : 'Open the demo shop'}
      </button>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
