'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthFrame } from '@/components/AuthFrame';
import { Button, Field, inputClass } from '@/components/ui';
import { ApiError, api } from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', shopName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await api('/auth/signup', { method: 'POST', body: JSON.stringify(form) });
      router.push('/app/start');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the account');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame title="Open your shop" lede="Email and password. Score sample orders before any real buyer data.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Your name">
          <input className={inputClass} value={form.name} onChange={(event) => set('name', event.target.value)} required />
        </Field>
        <Field label="Shop name">
          <input className={inputClass} value={form.shopName} onChange={(event) => set('shopName', event.target.value)} required />
        </Field>
        <Field label="Email">
          <input className={inputClass} type="email" autoComplete="email" value={form.email} onChange={(event) => set('email', event.target.value)} required />
        </Field>
        <Field label="Password (8+)">
          <input className={inputClass} type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={(event) => set('password', event.target.value)} required />
        </Field>
        {error ? <p className="text-sm text-risk">{error}</p> : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Creating…' : 'Create account'}
        </Button>
      </form>
      <p className="mt-6 text-sm text-inksoft">
        Already packing?{' '}
        <Link href="/login" className="font-medium text-ink underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </AuthFrame>
  );
}
