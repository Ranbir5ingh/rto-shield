'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button, Field, inputClass } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import type { PublicUser } from '@/lib/types';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await api<{ user: PublicUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      router.push(params?.get('next') || '/app');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log in');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <Link href="/" className="font-display text-3xl">
        RTO Shield
      </Link>
      <h1 className="mt-6 font-display text-4xl">Log in</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Email">
          <input className={inputClass} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Field label="Password">
          <input className={inputClass} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Checking…' : 'Log in'}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        New shop? <Link href="/signup" className="font-semibold text-saffron">Create an account</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
