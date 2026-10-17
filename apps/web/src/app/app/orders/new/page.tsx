'use client';

import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useToast } from '@/components/Toaster';
import { Button, Dropdown, Field, Page, Section, inputClass } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { invalidateShop } from '@/lib/queries';

const empty = {
  buyerName: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  orderValue: '799',
  paymentType: 'cod',
  priorOrders: '0',
  priorRtos: '0',
  productName: '',
};

export default function NewOrderPage() {
  const [form, setForm] = useState(empty);
  const [added, setAdded] = useState(0);
  const toast = useToast();
  const client = useQueryClient();

  function set<K extends keyof typeof empty>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createOrder(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api('/orders/manual', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          orderValue: Number(form.orderValue),
          priorOrders: Number(form.priorOrders),
          priorRtos: Number(form.priorRtos),
        }),
      });
      setForm(empty);
      setAdded((n) => n + 1);
      toast.success('Order added. Score when the batch is ready.');
      invalidateShop(client);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not add the order');
    }
  }

  return (
    <Page
      eyebrow="/ Scanner · Manual entry"
      title="Add an order"
      sub="One buyer, typed by hand. It lands in pending — score the batch when you're ready."
    >
      <Link href="/app/orders" className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] underline decoration-lime decoration-2 underline-offset-4">
        ← Back to scanner
      </Link>

      <div className="max-w-3xl">
        <Section eyebrow={added > 0 ? `Added this visit · ${added}` : 'Buyer details'} title="The order">
          <form onSubmit={createOrder} className="grid gap-4 sm:grid-cols-2">
            <Field label="Buyer name">
              <input className={inputClass} value={form.buyerName} onChange={(event) => set('buyerName', event.target.value)} required autoFocus />
            </Field>
            <Field label="Phone">
              <input className={inputClass} value={form.phone} onChange={(event) => set('phone', event.target.value)} required inputMode="tel" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address">
                <input className={inputClass} value={form.address} onChange={(event) => set('address', event.target.value)} required />
              </Field>
            </div>
            <Field label="City">
              <input className={inputClass} value={form.city} onChange={(event) => set('city', event.target.value)} />
            </Field>
            <Field label="State">
              <input className={inputClass} value={form.state} onChange={(event) => set('state', event.target.value)} />
            </Field>
            <Field label="Pincode" hint="6 digits, can't start with 0.">
              <input className={inputClass} value={form.pincode} onChange={(event) => set('pincode', event.target.value)} required pattern="[1-9][0-9]{5}" inputMode="numeric" />
            </Field>
            <Field label="Order value (₹)">
              <input className={inputClass} type="number" min={1} value={form.orderValue} onChange={(event) => set('orderValue', event.target.value)} required />
            </Field>
            <Field label="Payment">
              <Dropdown
                label="Payment"
                value={form.paymentType}
                onChange={(v) => set('paymentType', v)}
                options={[
                  { value: 'cod', label: 'Cash on delivery' },
                  { value: 'prepaid', label: 'Prepaid' },
                ]}
              />
            </Field>
            <Field label="Prior orders" hint="How many this buyer placed before.">
              <input className={inputClass} type="number" min={0} value={form.priorOrders} onChange={(event) => set('priorOrders', event.target.value)} />
            </Field>
            <Field label="Prior RTOs" hint="How many of those came back.">
              <input className={inputClass} type="number" min={0} value={form.priorRtos} onChange={(event) => set('priorRtos', event.target.value)} />
            </Field>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Button type="submit">Add pending order</Button>
              <Link href="/app/orders" className="btn-ghost !px-5 !py-3 !text-[11px]">
                Done — score them
              </Link>
            </div>
          </form>
        </Section>
      </div>
    </Page>
  );
}
