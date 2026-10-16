'use client';

import { useState } from 'react';
import { Button, Field, Notice, inputClass } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import type { ColumnMapping } from '@/lib/types';

const FIELDS: Array<{ key: keyof ColumnMapping; label: string; required?: boolean }> = [
  { key: 'orderId', label: 'Order id', required: true },
  { key: 'buyerName', label: 'Buyer name', required: true },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'address', label: 'Address', required: true },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pincode', label: 'Pincode', required: true },
  { key: 'orderValue', label: 'Order value', required: true },
  { key: 'paymentType', label: 'Payment type' },
  { key: 'orderedAt', label: 'Order time' },
  { key: 'outcome', label: 'Outcome' },
  { key: 'priorOrders', label: 'Prior orders' },
  { key: 'priorRtos', label: 'Prior RTOs' },
  { key: 'productName', label: 'Product' },
  { key: 'courier', label: 'Courier' },
];

interface Preview {
  headers: string[];
  preset: string;
  suggestedMapping: ColumnMapping;
  sampleRows: Array<Record<string, string>>;
  rowCount: number;
}

export function CsvImporter({
  mode,
  onImported,
}: {
  mode: 'history' | 'pending';
  onImported: (result: { inserted: number; skipped: number; errors: string[] }) => void;
}) {
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onFile(file: File) {
    setError('');
    const text = await file.text();
    setCsv(text);
    try {
      const body = await api<Preview>('/orders/preview', { method: 'POST', body: JSON.stringify({ csv: text }) });
      setPreview(body);
      setMapping(body.suggestedMapping);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not read that file');
    }
  }

  async function commit() {
    if (!mapping) return;
    setPending(true);
    setError('');
    try {
      const result = await api<{ inserted: number; skipped: number; errors: string[] }>('/orders/import', {
        method: 'POST',
        body: JSON.stringify({
          mode,
          csv,
          mapping,
          source: preview?.preset === 'unknown' ? 'generic' : preview?.preset,
        }),
      });
      onImported(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Import failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field label={mode === 'history' ? 'Historical CSV' : 'Pending orders CSV'}>
        <input
          className={inputClass}
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
      </Field>
      <p className="text-xs text-ink/60">
        Templates:{' '}
        <a className="underline" href="/samples/generic-template.csv">
          generic
        </a>
        {' · '}
        <a className="underline" href="/samples/shopify-sample.csv">
          Shopify-style
        </a>
        {' · '}
        <a className="underline" href="/samples/meesho-sample.csv">
          Meesho-style
        </a>
        . History rows need a delivered or RTO outcome. Empty payment is treated as COD. Shopify “pending” is treated as COD; “paid” as prepaid.
      </p>
      {preview && mapping ? (
        <div className="card p-4">
          <p className="text-sm">
            {preview.rowCount} rows · detected <strong>{preview.preset}</strong>
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <Field key={field.key} label={`${field.label}${field.required ? ' *' : ''}`}>
                <select
                  className={inputClass}
                  value={mapping[field.key] || ''}
                  onChange={(event) => setMapping({ ...mapping, [field.key]: event.target.value })}
                >
                  <option value="">—</option>
                  {preview.headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <div className="mt-4">
            <Button type="button" onClick={commit} disabled={pending}>
              {pending ? 'Importing…' : mode === 'history' ? 'Import history' : 'Import pending orders'}
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
    </div>
  );
}
