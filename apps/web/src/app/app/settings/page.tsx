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
  const [testing, setTesting] = useState(false);

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
          autopilot: user.reduction?.autopilot !== false,
          prepaidEnabled: user.reduction?.prepaidEnabled !== false,
          discountPct: Number(user.reduction?.discountPct ?? 5),
          minRisk: Number(user.reduction?.minRisk ?? 60),
          escalationMinutes: Number(user.reduction?.escalationMinutes ?? 120),
          noReply: user.reduction?.noReply === 'cancel' ? 'cancel' : 'hold',
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
      <form id="shop-settings" onSubmit={save} className="space-y-6 lg:space-y-8" data-tour-ready="true">
        <Section eyebrow="01 · Autopilot" title="Policy" tour="autopilot">
          <p className="-mt-2 mb-5 max-w-xl text-[15px] leading-7 text-ink/70">
            On by default. The shop sends the address ask, the payment link, and the reminder. You only see what stops.
          </p>
          <FormGrid>
            <div className="sm:col-span-2">
              <Field label="Autopilot">
                <label className="flex items-center gap-3 border-2 border-ink bg-white px-4 py-3.5 shadow-sticker-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#1B1712]"
                    checked={user.reduction?.autopilot !== false}
                    disabled={demo}
                    onChange={(event) => setUser(patchReduction(user, { autopilot: event.target.checked }))}
                  />
                  <span className="text-[15px]">Run the shop without a morning queue</span>
                </label>
              </Field>
            </div>
            <Field label="If nobody replies">
              {demo ? (
                <p className="font-mono text-sm font-bold uppercase tracking-[0.12em]">{user.reduction?.noReply === 'cancel' ? 'Cancel' : 'Hold'}</p>
              ) : (
                <Dropdown
                  label="If nobody replies"
                  value={user.reduction?.noReply === 'cancel' ? 'cancel' : 'hold'}
                  onChange={(value) => setUser(patchReduction(user, { noReply: value === 'cancel' ? 'cancel' : 'hold' }))}
                  options={[
                    { value: 'hold', label: 'Hold' },
                    { value: 'cancel', label: 'Cancel' },
                  ]}
                />
              )}
            </Field>
          </FormGrid>
        </Section>

        <Section eyebrow="02 · Profile" title="The shop">
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

        <Section eyebrow="03 · Prepaid" title="Payment link">
          <FormGrid>
            <div className="sm:col-span-2">
              <Field label="Prepaid offers">
                <label className="flex items-center gap-3 border-2 border-ink bg-white px-4 py-3.5 shadow-sticker-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#1B1712]"
                    checked={user.reduction?.prepaidEnabled !== false}
                    disabled={demo}
                    onChange={(event) => setUser(patchReduction(user, { prepaidEnabled: event.target.checked }))}
                  />
                  <span className="text-[15px]">Send a payment link on high-risk COD. The discount is on the pay page.</span>
                </label>
              </Field>
            </div>
            <Field label="Prepaid discount %" hint="Shown on the pay page, not in the WhatsApp template.">
              <input className={inputClass} type="number" min={0} max={50} readOnly={demo} value={user.reduction?.discountPct ?? 5} onChange={(event) => setUser(patchReduction(user, { discountPct: Number(event.target.value) }))} />
            </Field>
            <Field label="Minimum risk for prepaid" hint="Only orders scoring above this get the link.">
              <input className={inputClass} type="number" min={0} max={100} readOnly={demo} value={user.reduction?.minRisk ?? 60} onChange={(event) => setUser(patchReduction(user, { minRisk: Number(event.target.value) }))} />
            </Field>
            <Field label="Minutes before a call" hint="After WhatsApp, if the buyer has not replied.">
              <input className={inputClass} type="number" min={0} max={1440} readOnly={demo} value={user.reduction?.escalationMinutes ?? 120} onChange={(event) => setUser(patchReduction(user, { escalationMinutes: Number(event.target.value) }))} />
            </Field>
          </FormGrid>
        </Section>
      </form>

      <Section eyebrow="04 · Calls" title="Voice calls">
        <p className="-mt-2 max-w-xl text-[15px] leading-7 text-ink/70">
          Calls are included. RTO Shield places them.
        </p>
      </Section>

      <Section eyebrow="05 · Connections" title="Where orders come from">
        <Connections locked={demo} />
        {user.role === 'owner' ? (
          <div className="mt-6 border-t-2 border-ink pt-5">
            <p className="font-display text-lg font-extrabold uppercase tracking-tight">Test message</p>
            <p className="mt-2 max-w-xl text-[15px] leading-7 text-ink/70">
              Sends the approved confirmation template to your allowlisted number. It does not change an order.
            </p>
            <Button
              type="button"
              className="mt-4"
              disabled={testing}
              onClick={() => {
                setTesting(true);
                api('/whatsapp/test-allowlist', { method: 'POST' })
                  .then(() => toast.success('Test message sent.'))
                  .catch((err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Could not send the test'))
                  .finally(() => setTesting(false));
              }}
            >
              {testing ? 'Sending…' : 'Send test message to my number'}
            </Button>
          </div>
        ) : null}
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
              ['Voice calls', status?.elevenlabs ? 'platform' : 'script only'],
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

function patchReduction(user: PublicUser, patch: Partial<NonNullable<PublicUser['reduction']>>): PublicUser {
  return {
    ...user,
    reduction: {
      autopilot: user.reduction?.autopilot !== false,
      prepaidEnabled: user.reduction?.prepaidEnabled !== false,
      discountPct: user.reduction?.discountPct ?? 5,
      minRisk: user.reduction?.minRisk ?? 60,
      escalationMinutes: user.reduction?.escalationMinutes ?? 120,
      noReply: user.reduction?.noReply === 'cancel' ? 'cancel' : 'hold',
      ...patch,
    },
  };
}

