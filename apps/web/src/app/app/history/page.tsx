'use client';

import { useState } from 'react';
import { CsvImporter } from '@/components/CsvImporter';
import { Button, Notice } from '@/components/ui';
import { ApiError, api } from '@/lib/api';

export default function HistoryPage() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function sample() {
    setPending(true);
    setError('');
    try {
      const result = await api<{ history: number; pending: number; notice: string }>('/orders/sample', { method: 'POST' });
      setMessage(`Loaded ${result.history} historical orders and ${result.pending} pending ones. ${result.notice}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not build sample data');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-medium text-display-2">Order history</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/70">
          The model learns delivered versus RTO from this shop only. Sample buyers are synthetic Indian names, Hinglish addresses, and planted correlations — safe to click through.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={sample} disabled={pending}>
          {pending ? 'Building sample…' : 'Try with sample data'}
        </Button>
        <a className="btn btn-ghost" href="/samples/generic-template.csv">
          Download generic template
        </a>
      </div>
      {message ? <Notice tone="good">{message}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
      <CsvImporter
        mode="history"
        onImported={(result) =>
          setMessage(`Imported ${result.inserted} history rows. Skipped ${result.skipped}. ${result.errors.join(' ')}`)
        }
      />
    </div>
  );
}
