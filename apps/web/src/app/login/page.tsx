'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthFrame } from '@/components/AuthFrame';
import { DemoButton } from '@/components/DemoButton';
import { useToast } from '@/components/Toaster';
import { Button, Field, inputClass } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import type { PublicUser } from '@/lib/types';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const emailProblem = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? '' : 'Enter a valid email, like asha@shop.in.';
    const passwordProblem = password.length >= 8 ? '' : 'Use at least 8 characters.';
    setEmailError(emailProblem);
    setPasswordError(passwordProblem);
    if (emailProblem || passwordProblem) return;
    setPending(true);
    try {
      await api<{ user: PublicUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      router.push(params?.get('next') || '/app');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not log in');
      setPending(false);
    }
  }

  return (
    <AuthFrame title="Log in" lede="Your shop, scores, and confirmation queue.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Email" error={emailError}>
          <input className={inputClass} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Field label="Password" error={passwordError}>
          <input className={inputClass} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Checking…' : 'Log in'}
        </Button>
      </form>
      <div className="mt-8 border-t border-ink/20 pt-6">
        <p className="mb-3 text-sm text-inksoft">Judging the product? Skip the spreadsheet.</p>
        <DemoButton />
      </div>
      <p className="mt-6 text-sm text-inksoft">
        New shop?{' '}
        <Link href="/signup" className="font-medium text-ink underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthFrame>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
