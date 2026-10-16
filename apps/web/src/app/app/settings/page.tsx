'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Notice, inputClass } from '@/components/ui';
import { ApiError, api, downloadExport } from '@/lib/api';
import type { Integrations, PublicUser } from '@/lib/types';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<Integrations | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    api<{ user: PublicUser }>('/auth/me').then((body) => setUser(body.user)).catch(() => undefined);
    api<Integrations>('/integrations').then(setStatus).catch(() => undefined);
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setError('');
    try {
      const body = await api<{ user: PublicUser }>('/account/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          name: user.name,
          shopName: user.shopName,
          rtoCostInr: Number(user.rtoCostInr),
          messageLanguage: user.messageLanguage,
        }),
      });
      setUser(body.user);
      setMessage('Saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save');
    }
  }

  async function wipe() {
    setError('');
    try {
      await api('/account/data', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) });
      setMessage('Orders deleted. The login remains.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete data');
    }
  }

  async function removeAccount() {
    setError('');
    try {
      await api('/account', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE', password }) });
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the account');
    }
  }

  if (!user) return <div className="skeleton h-48" aria-busy="true" aria-label="Loading settings" />;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display font-medium text-display-2">Settings</h1>
      {message ? <Notice tone="good">{message}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
      <form onSubmit={save} className="panel space-y-3 p-5 shadow-card">
        <Field label="Your name">
          <input className={inputClass} value={user.name} onChange={(event) => setUser({ ...user, name: event.target.value })} />
        </Field>
        <Field label="Shop name">
          <input className={inputClass} value={user.shopName} onChange={(event) => setUser({ ...user, shopName: event.target.value })} />
        </Field>
        <Field label="Cost per RTO (₹)">
          <input className={inputClass} type="number" min={0} value={user.rtoCostInr} onChange={(event) => setUser({ ...user, rtoCostInr: Number(event.target.value) })} />
        </Field>
        <Field label="Default confirmation language">
          <select className={inputClass} value={user.messageLanguage} onChange={(event) => setUser({ ...user, messageLanguage: event.target.value as PublicUser['messageLanguage'] })}>
            <option value="hinglish">Hinglish</option>
            <option value="hindi">Hindi</option>
            <option value="english">English</option>
          </select>
        </Field>
        <Button type="submit">Save</Button>
      </form>
      <section className="panel p-5 text-sm">
        <h2 className="font-medium">Integrations</h2>
        <dl className="mt-4 divide-y divide-line">
          {[
            ['Encryption', status?.encryption],
            ['Database', status?.mongodb],
            ['Scoring service', status?.ml.reachable ? status.ml.activePredictor : 'unreachable'],
            ['TabPFN token', status?.ml.tabpfnToken ? 'set' : 'missing'],
            ['Gemma via AI Studio', status?.ml.gemini ? 'set' : 'missing'],
            ['Ollama (local Gemma)', status?.ml.ollama ? 'set' : 'missing'],
            ['ElevenLabs voice', status?.elevenlabs ? 'set' : 'missing — script only'],
            ['SerpApi pincode search', status?.serpapi ? 'set' : 'missing — embedded localities only'],
            ['Sentry', status?.sentry ? 'set' : 'missing'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-muted">{label}</dt>
              <dd className="text-right font-mono text-xs">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="flex flex-wrap gap-3">
        <Button type="button" tone="ghost" onClick={() => downloadExport().catch(() => setError('Export failed'))}>
          Export my data
        </Button>
        <Button type="button" tone="danger" onClick={wipe}>
          Delete all orders
        </Button>
      </div>
      <section className="space-y-3 rounded-2xl border border-danger/30 p-4">
        <h2 className="font-semibold">Delete account</h2>
        <Field label="Password">
          <input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <Button type="button" tone="danger" onClick={removeAccount}>
          Delete account and orders
        </Button>
      </section>
    </div>
  );
}
