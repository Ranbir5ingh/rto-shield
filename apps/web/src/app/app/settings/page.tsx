'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Connections } from '@/components/Connections';
import { useToast } from '@/components/Toaster';
import { Button, Dropdown, Field, inputClass } from '@/components/ui';
import { ApiError, api, downloadExport } from '@/lib/api';
import type { Integrations, PublicUser } from '@/lib/types';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<Integrations | null>(null);
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    api<{ user: PublicUser }>('/auth/me').then((body) => setUser(body.user)).catch(() => undefined);
    api<Integrations>('/integrations').then(setStatus).catch(() => undefined);
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
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
      toast.success('Saved.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save');
    }
  }

  async function wipe() {
    try {
      await api('/account/data', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) });
      toast.success('Orders deleted. The login remains.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete data');
    }
  }

  async function removeAccount() {
    if (!password) {
      setPasswordError('Enter your password.');
      return;
    }
    setPasswordError('');
    try {
      await api('/account', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE', password }) });
      router.replace('/');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete the account');
    }
  }

  if (!user) return <div className="skeleton h-48" aria-busy="true" aria-label="Loading settings" />;
  const demo = user.role === 'demo';

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display font-medium text-display-2">Settings</h1>
      {demo ? <p className="text-sm leading-6 text-ink/75">This demo account is read-only. You can still score orders and approve messages from the queue.</p> : null}
      <form onSubmit={save} className="panel space-y-3 p-5 shadow-card">
        <Field label="Your name">
          <input className={inputClass} value={user.name} readOnly={demo} onChange={(event) => setUser({ ...user, name: event.target.value })} />
        </Field>
        <Field label="Shop name">
          <input className={inputClass} value={user.shopName} readOnly={demo} onChange={(event) => setUser({ ...user, shopName: event.target.value })} />
        </Field>
        <Field label="Cost per RTO (₹)">
          <input className={inputClass} type="number" min={0} value={user.rtoCostInr} readOnly={demo} onChange={(event) => setUser({ ...user, rtoCostInr: Number(event.target.value) })} />
        </Field>
        <Field label="Default confirmation language">
          {demo ? (
            <p className="font-mono text-sm font-bold uppercase tracking-[0.12em]">{user.messageLanguage}</p>
          ) : (
            <Dropdown
              label="Default confirmation language"
              value={user.messageLanguage}
              onChange={(v) => setUser({ ...user, messageLanguage: v as PublicUser['messageLanguage'] })}
              options={[
                { value: 'hinglish', label: 'Hinglish' },
                { value: 'hindi', label: 'Hindi' },
                { value: 'english', label: 'English' },
              ]}
            />
          )}
        </Field>
        {demo ? null : <Button type="submit">Save</Button>}
      </form>
      <Connections locked={demo} />
      {status && !status.sellerView ? <section className="panel p-5 text-sm">
        <h2 className="font-medium">Integrations</h2>
        <dl className="mt-4 divide-y divide-line">
          {[
            ['Encryption', status?.encryption],
            ['Database', status?.mongodb],
            ['Scoring service', status?.ml.reachable ? status.ml.activePredictor : 'unreachable'],
            ['TabPFN token', status?.ml.tabpfnToken ? 'set' : 'missing'],
            ['Gemma via AI Studio', status?.ml.gemmaReady ? 'answering' : status?.ml.gemini ? 'set' : 'missing'],
            ['Ollama (local Gemma)', status?.ml.ollama ? 'set' : 'missing'],
            ['ElevenLabs voice', status?.elevenlabs ? 'set' : 'missing — script only'],
            ['SerpApi pincode search', status?.serpapi ? 'set' : 'missing — embedded localities only'],
            ['Sentry', status?.sentry ? 'set' : 'missing'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-inksoft">{label}</dt>
              <dd className="text-right font-mono text-xs">{value}</dd>
            </div>
          ))}
        </dl>
      </section> : null}
      {demo ? null : (
      <div className="flex flex-wrap gap-3">
        <Button type="button" tone="ghost" onClick={() => downloadExport().catch(() => toast.error('Export failed'))}>
          Export my data
        </Button>
        <Button type="button" tone="danger" onClick={wipe}>
          Delete all orders
        </Button>
      </div>
      )}
      {demo ? null : <section className="space-y-3 rounded-2xl border border-danger/30 p-4">
        <h2 className="font-semibold">Delete account</h2>
        <Field label="Password" error={passwordError}>
          <input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <Button type="button" tone="danger" onClick={removeAccount}>
          Delete account and orders
        </Button>
      </section>}
    </div>
  );
}
