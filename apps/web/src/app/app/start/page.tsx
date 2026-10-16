'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Notice } from '@/components/ui';
import { ApiError, api } from '@/lib/api';

export default function StartPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function sample() {
    setPending(true);
    setError('');
    try {
      await api('/orders/sample', { method: 'POST' });
      await api('/orders/score', { method: 'POST' });
      router.push('/app');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not prepare the sample shop');
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">Shop setup</p>
      <h1 className="font-display text-display-2">How should this shop learn?</h1>
      <p className="text-sm leading-7 text-ink/75">
        The model needs past outcomes. You can load a synthetic Indian shop and score it now, or bring your own sheet. Real phones stay encrypted. Sample buyers are invented.
      </p>
      {error ? <Notice>{error}</Notice> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <article className="panel p-5">
          <h2 className="font-display text-2xl">Sample shop</h2>
          <p className="mt-2 text-sm leading-6 text-ink/70">360 labelled orders and a pending batch, then a first score.</p>
          <Button type="button" className="mt-4" onClick={sample} disabled={pending}>
            {pending ? 'Scoring sample orders…' : 'Load and score'}
          </Button>
        </article>
        <article className="panel p-5">
          <h2 className="font-display text-2xl">Your sheet</h2>
          <p className="mt-2 text-sm leading-6 text-ink/70">Shopify export, a Meesho-style file, or the generic template.</p>
          <Link href="/app/history" className="btn btn-ghost mt-4">
            Upload history
          </Link>
        </article>
      </div>
    </div>
  );
}
