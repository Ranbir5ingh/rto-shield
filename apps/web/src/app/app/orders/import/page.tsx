'use client';

import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CsvImporter } from '@/components/CsvImporter';
import { Page, Section } from '@/components/ui';
import { invalidateShop } from '@/lib/queries';

export default function ImportOrdersPage() {
  const client = useQueryClient();
  const [batches, setBatches] = useState(0);

  return (
    <Page
      eyebrow="/ Orders · Import"
      title="Upload a CSV"
      sub="A Shopify export, a Meesho-style file, or the generic template. Columns are matched automatically."
    >
      <Link href="/app/orders" className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] underline decoration-lime decoration-2 underline-offset-4">
        ← Orders
      </Link>

      <div className="max-w-3xl">
        <Section
          eyebrow={batches > 0 ? `Imported this visit · ${batches} file${batches === 1 ? '' : 's'}` : 'Drop a file'}
          title="The spreadsheet"
          action={
            <a className="btn-ghost !px-4 !py-2.5 !text-[10px]" href="/samples/generic-template.csv">
              Get the template
            </a>
          }
        >
          <CsvImporter
            mode="pending"
            onImported={() => {
              setBatches((n) => n + 1);
              invalidateShop(client);
            }}
          />
          <div className="mt-6 border-t-2 border-dashed border-ink/20 pt-4">
            <Link href="/app/orders" className="btn-go inline-flex !px-5 !py-3 !text-[11px]">
              Done — score them
            </Link>
          </div>
        </Section>
      </div>
    </Page>
  );
}
