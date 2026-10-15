'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { DemoButton } from '@/components/DemoButton';
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
    <div className="panel mx-auto my-10 flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-12 sm:px-10">
      <Link href="/" className="text-lg font-medium">
        RTO Shield
      </Link>
      <h1 className="mt-6 font-medium text-display-2">Log in</h1>
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
      <div className="mt-6 border-t border-line pt-4">
        <p className="mb-3 text-sm text-ink/70">Judging the product? Skip the spreadsheet.</p>
        <DemoButton />
      </div>
      <p className="mt-4 text-sm">
        New shop? <Link href="/signup" className="font-medium underline">Create an account</Link>
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
