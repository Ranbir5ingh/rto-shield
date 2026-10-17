'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CsvImporter } from '@/components/CsvImporter';
import { useToast } from '@/components/Toaster';
import { Button, Page, Section } from '@/components/ui';
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
    <Page
      eyebrow="/ Training data"
      title="Order history"
      sub="The model learns delivered versus RTO from this shop only. Sample buyers are synthetic Indian names, Hinglish addresses, and planted correlations — safe to click through."
      actions={
        <>
          <Button type="button" onClick={sample} disabled={pending}>
            {pending ? 'Building sample…' : 'Try with sample data'}
          </Button>
          <a className="btn-ghost !px-5 !py-3 !text-[11px]" href="/samples/generic-template.csv">
            Download template
          </a>
        </>
      }
    >
      <Section eyebrow="Upload" title="Import a CSV">
        <CsvImporter mode="history" onImported={() => invalidateShop(client)} />
      </Section>
    </Page>
  );
}
