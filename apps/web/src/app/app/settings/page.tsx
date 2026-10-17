'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Connections } from '@/components/Connections';
import { useToast } from '@/components/Toaster';
import { Button, Dropdown, Field, FormGrid, Page, Section, inputClass } from '@/components/ui';
import { ApiError, api, downloadExport } from '@/lib/api';
import { qk, useIntegrations, useMe } from '@/lib/queries';
import type { PublicUser } from '@/lib/types';

export default function SettingsPage() {
  const router = useRouter();
  const client = useQueryClient();
  const me = useMe();
  const status = useIntegrations();
  const [user, setUser] = useState<PublicUser | null>(null);
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (me.data && !user) setUser(me.data);
  }, [me.data, user]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!user || saving) return;
    setSaving(true);
    const previous = user;
    client.setQueryData(qk.me, user);
    try {
      const body = await api<{ user: PublicUser }>('/account/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          name: user.name,
          shopName: user.shopName,
          rtoCostInr: Number(user.rtoCostInr),
          messageLanguage: user.messageLanguage,
          prepaidEnabled: user.reduction?.prepaidEnabled !== false,
          discountPct: Number(user.reduction?.discountPct ?? 5),
          minRisk: Number(user.reduction?.minRisk ?? 60),
          escalationMinutes: Number(user.reduction?.escalationMinutes ?? 120),
        }),
      });
      setUser(body.user);
      client.setQueryData(qk.me, body.user);
      toast.success('Saved.');
    } catch (err) {
      setUser(previous);
      client.setQueryData(qk.me, previous);
      toast.error(err instanceof ApiError ? err.message : 'Could not save');
    } finally {
      setSaving(false);
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

  if (!user) {
    return (
      <Page eyebrow="/ Shop" title="Settings">
        <div className="skeleton h-48" aria-busy="true" aria-label="Loading settings" />
      </Page>
    );
  }
  const demo = user.role === 'demo';

  return (
    <Page
      eyebrow="/ Shop"
      title="Settings"
      sub={demo ? 'This demo account is read-only. You can still score orders and approve messages from the queue.' : 'How the shop talks, what a return costs you, and when the shield steps in.'}
      actions={demo ? null : (
        <Button type="submit" form="shop-settings" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      )}
    >
      <form id="shop-settings" onSubmit={save} className="space-y-6 lg:space-y-8">
        <Section eyebrow="01 · Profile" title="The shop">
          <FormGrid>
            <Field label="Your name">
              <input className={inputClass} value={user.name} readOnly={demo} onChange={(event) => setUser({ ...user, name: event.target.value })} />
            </Field>
            <Field label="Shop name">
              <input className={inputClass} value={user.shopName} readOnly={demo} onChange={(event) => setUser({ ...user, shopName: event.target.value })} />
            </Field>
            <Field label="Cost per RTO (₹)" hint="Forward + return shipping. Used for the ₹ at risk math.">
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
          </FormGrid>
        </Section>

        <Section eyebrow="02 · Automation" title="Risk playbook">
          <FormGrid>
            <div className="sm:col-span-2">
              <Field label="Prepaid offers">
                <label className="flex items-center gap-3 border-2 border-ink bg-white px-4 py-3.5 shadow-sticker-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#1B1712]"
                    checked={user.reduction?.prepaidEnabled !== false}
                    disabled={demo}
                    onChange={(event) => setUser({ ...user, reduction: { prepaidEnabled: event.target.checked, discountPct: user.reduction?.discountPct ?? 5, minRisk: user.reduction?.minRisk ?? 60, escalationMinutes: user.reduction?.escalationMinutes ?? 120 } })}
                  />
                  <span className="text-[15px]">Offer prepaid checkout on high-risk COD orders</span>
                </label>
              </Field>
            </div>
            <Field label="Prepaid discount %" hint="Sweetener on the prepaid checkout link.">
              <input className={inputClass} type="number" min={0} max={50} readOnly={demo} value={user.reduction?.discountPct ?? 5} onChange={(event) => setUser({ ...user, reduction: { prepaidEnabled: user.reduction?.prepaidEnabled !== false, discountPct: Number(event.target.value), minRisk: user.reduction?.minRisk ?? 60, escalationMinutes: user.reduction?.escalationMinutes ?? 120 } })} />
            </Field>
            <Field label="Minimum risk for prepaid" hint="Only orders scoring above this get the offer.">
              <input className={inputClass} type="number" min={0} max={100} readOnly={demo} value={user.reduction?.minRisk ?? 60} onChange={(event) => setUser({ ...user, reduction: { prepaidEnabled: user.reduction?.prepaidEnabled !== false, discountPct: user.reduction?.discountPct ?? 5, minRisk: Number(event.target.value), escalationMinutes: user.reduction?.escalationMinutes ?? 120 } })} />
            </Field>
            <Field label="Call if no WhatsApp reply" hint="Minutes before the buyer gets a voice call instead.">
              <input className={inputClass} type="number" min={0} max={1440} readOnly={demo} value={user.reduction?.escalationMinutes ?? 120} onChange={(event) => setUser({ ...user, reduction: { prepaidEnabled: user.reduction?.prepaidEnabled !== false, discountPct: user.reduction?.discountPct ?? 5, minRisk: user.reduction?.minRisk ?? 60, escalationMinutes: Number(event.target.value) } })} />
            </Field>
          </FormGrid>
        </Section>
      </form>

      <Section eyebrow="03 · Voice" title="ElevenLabs">
        <ElevenLabsKey demo={demo} configured={Boolean(user.elevenlabsConfigured)} last4={user.elevenlabsLast4 || ''} onSaved={(last4) => setUser({ ...user, elevenlabsConfigured: true, elevenlabsLast4: last4 })} />
      </Section>

      <Section eyebrow="04 · Connections" title="Where orders come from">
        <Connections locked={demo} />
      </Section>

      {status && !status.sellerView ? (
        <Section eyebrow="05 · System" title="Integrations">
          <dl className="divide-y-2 divide-dashed divide-ink/15">
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
              <div key={label} className="flex items-start justify-between gap-4 py-3">
                <dt className="shrink-0 text-[15px] text-inksoft">{label}</dt>
                <dd className="min-w-0 break-words text-right font-mono text-xs font-bold">{value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}

      {demo ? null : (
        <Section eyebrow="06 · Your data" title="Export or wipe">
          <p className="-mt-2 mb-5 max-w-xl text-[15px] leading-7 text-ink/70">
            Take everything with you, or delete every order the shield has ever seen. The login stays either way.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" tone="ghost" onClick={() => downloadExport().catch(() => toast.error('Export failed'))}>
              Export my data
            </Button>
            <Button type="button" tone="danger" onClick={wipe}>
              Delete all orders
            </Button>
          </div>
        </Section>
      )}

      {demo ? null : (
        <section className="border-2 border-risk bg-white p-5 shadow-sticker sm:p-6 lg:p-7">
          <p className="eyebrow text-risk">07 · Danger zone</p>
          <h2 className="mt-2 font-display text-xl font-extrabold uppercase tracking-tight md:text-2xl">
            Delete account
          </h2>
          <p className="-mt-1 mb-5 mt-3 max-w-xl text-[15px] leading-7 text-ink/70">
            This removes the account and every order with it. There is no undo.
          </p>
          <div className="max-w-sm">
            <Field label="Password" error={passwordError}>
              <input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </Field>
            <Button type="button" tone="danger" onClick={removeAccount} className="mt-4">
              Delete account and orders
            </Button>
          </div>
        </section>
      )}
    </Page>
  );
}

function ElevenLabsKey({ demo, configured, last4, onSaved }: { demo: boolean; configured: boolean; last4: string; onSaved: (last4: string) => void }) {
  const toast = useToast();
  const [apiKey, setApiKey] = useState('');
  if (demo) return null;
  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      const body = await api<{ last4: string; configured: boolean }>('/elevenlabs', { method: 'POST', body: JSON.stringify({ apiKey }) });
      setApiKey('');
      onSaved(body.last4 || '');
      toast.success(body.configured ? 'ElevenLabs key saved.' : 'Saved.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save the ElevenLabs key');
    }
  }
  return (
    <form onSubmit={save}>
      <p className="-mt-2 mb-4 max-w-xl text-[15px] leading-7 text-ink/70">
        Optional seller key for voice calls. The platform key on the server is used when this is empty. Stored encrypted.
      </p>
      <p className="mb-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-inksoft">
        {configured ? `Saved ···· ${last4}` : 'No seller key'}
      </p>
      <div className="max-w-sm">
        <Field label="API key">
          <input className={inputClass} type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
        </Field>
        <Button type="submit" className="mt-4">Save key</Button>
      </div>
    </form>
  );
}
