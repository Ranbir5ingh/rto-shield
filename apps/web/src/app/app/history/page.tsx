'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CsvImporter } from '@/components/CsvImporter';
import { useToast } from '@/components/Toaster';
import { Button } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { invalidateShop } from '@/lib/queries';

export default function HistoryPage() {
  const toast = useToast();
  const client = useQueryClient();
  const [pending, setPending] = useState(false);

  async function sample() {
    setPending(true);
    try {
      const result = await api<{ history: number; pending: number; notice: string }>('/orders/sample', { method: 'POST' });
      toast.success(`Loaded ${result.history} historical orders and ${result.pending} pending ones. ${result.notice}`);
      invalidateShop(client);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not build sample data');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-medium text-display-2">Order history</h1>
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
      <CsvImporter mode="history" onImported={() => invalidateShop(client)} />
    </div>
  );
}
