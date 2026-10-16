'use client';

import { useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { Button, Dropdown, Field, Notice } from '@/components/ui';
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
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setError('');
    setFileName(file.name);
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
      <div>
        <p className="eyebrow">{mode === 'history' ? 'Historical CSV' : 'Pending orders CSV'}</p>
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void onFile(file);
          }}
          className={`mt-2.5 flex cursor-pointer flex-col items-center justify-center gap-3 border border-dashed px-6 py-10 text-center transition ${
            dragOver ? 'border-go bg-go/5' : 'border-line bg-panel hover:border-white/40'
          }`}
        >
          <FileUp size={22} className={dragOver ? 'text-go' : 'text-muted'} />
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-white">
            {fileName || 'Drop your CSV here or click to browse'}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">.CSV only · stays in your shop</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
              event.target.value = '';
            }}
          />
        </label>
      </div>
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
        <div className="panel p-4">
          <p className="text-sm">
            {preview.rowCount} rows · detected <strong>{preview.preset}</strong>
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <Field key={field.key} label={`${field.label}${field.required ? ' *' : ''}`}>
                <Dropdown
                  label={field.label}
                  value={mapping[field.key] || ''}
                  onChange={(v) => setMapping({ ...mapping, [field.key]: v })}
                  placeholder="—"
                  options={preview.headers.map((header) => ({ value: header, label: header }))}
                />
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
