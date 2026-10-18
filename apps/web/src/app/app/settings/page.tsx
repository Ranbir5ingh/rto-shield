'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Connections } from '@/components/Connections';
import { useToast } from '@/components/Toaster';
import { Button, Dropdown, Field, FormGrid, Page, Section, inputClass } from '@/components/ui';
import { ApiError, api, downloadExport } from '@/lib/api';
import { qk, useIntegrations, useMe } from '@/lib/queries';
import { isDemoSession } from '@/lib/tours';
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
  const [confirm, setConfirm] = useState<'wipe' | 'account' | 'autopilot' | 'reset' | null>(null);

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
  const demo = isDemoSession(user);
  const canResetDemo = demo;

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
                    onChange={(event) => {
                      if (!event.target.checked) {
                        setConfirm('autopilot');
                        return;
                      }
                      setUser(patchReduction(user, { autopilot: event.target.checked }));
                    }}
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
          Calls: by RTO Shield. Autopilot calls the buyer. On an exception, Try one more call places one extra call. With calls set to live, that call dials the buyer. In this test setup it is marked Simulated call and does not dial. The demo can still open a browser call so you can talk to the agent.
        </p>
      </Section>

      <Section eyebrow="05 · Connections" title="Where orders come from">
        <Connections locked={demo} owner={user.role === 'owner' && !demo} />
        {user.role === 'owner' && !demo ? (
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
        <Section eyebrow="06 · System" title="Integrations">
          <dl className="divide-y-2 divide-dashed divide-ink/15">
            {[
              ['Encryption', status?.encryption],
              ['Database', status?.mongodb],
              ['Scoring service', status?.ml.reachable ? status.ml.activePredictor : 'unreachable'],
              ['TabPFN token', status?.ml.tabpfnToken ? 'set' : 'missing'],
              ['Platform Gemini', status?.ml.gemmaReady ? 'answering' : status?.ml.gemini ? 'set' : 'missing'],
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
        <Section eyebrow={status && !status.sellerView ? '07 · Your data' : '06 · Your data'} title="Export or wipe">
          <p className="-mt-2 mb-5 max-w-xl text-[15px] leading-7 text-ink/70">
            Take everything with you, or delete every order the shield has ever seen. The login stays either way.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" tone="ghost" onClick={() => downloadExport().catch(() => toast.error('Export failed'))}>
              Export my data
            </Button>
            <Button type="button" tone="danger" onClick={() => setConfirm('wipe')}>
              Delete all orders
            </Button>
          </div>
        </Section>
      )}

      {demo ? null : (
        <section className="border-2 border-risk bg-white p-5 shadow-sticker sm:p-6 lg:p-7">
          <p className="eyebrow text-risk">{status && !status.sellerView ? '08 · Danger zone' : '07 · Danger zone'}</p>
          <h2 className="mt-2 font-display text-xl font-extrabold uppercase tracking-tight md:text-2xl">
            Delete account
          </h2>
          <p className="-mt-1 mb-5 mt-3 max-w-xl text-[15px] leading-7 text-ink/70">
            This removes the account and every order with it. There is no undo.
          </p>
          <Button type="button" tone="danger" onClick={() => setConfirm('account')}>
            Delete account and orders
          </Button>
        </section>
      )}

      {canResetDemo ? (
        <Section eyebrow="Demo" title="Reset the demo">
          <p className="-mt-2 mb-5 max-w-xl text-[15px] leading-7 text-ink/70">
            Puts the demo orders back to the baseline. Scores and decisions you made in this session go away.
          </p>
          <Button type="button" tone="danger" onClick={() => setConfirm('reset')}>
            Reset the demo
          </Button>
        </Section>
      ) : null}

      <ConfirmDialog
        open={confirm === 'autopilot'}
        title="Turn autopilot off"
        body="The shop will stop sending address asks, payment links, and reminders until you turn it back on and save."
        confirmLabel="Turn autopilot off"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setUser(patchReduction(user, { autopilot: false }));
          setConfirm(null);
          toast.info('Autopilot is off. Save changes to keep it.');
        }}
      />
      <ConfirmDialog
        open={confirm === 'wipe'}
        title="Delete all orders"
        body="Every order this shop has scored is deleted. The login stays. There is no undo."
        confirmLabel="Delete all orders"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void wipe();
        }}
      />
      <ConfirmDialog
        open={confirm === 'account'}
        title="Delete account"
        body="This removes the account and every order with it. There is no undo."
        confirmLabel="Delete account and orders"
        onClose={() => setConfirm(null)}
        onConfirm={() => void removeAccount()}
      >
        <Field label="Password" error={passwordError}>
          <input className={inputClass} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'reset'}
        title="Reset the demo"
        body="Demo orders go back to the baseline. This does not change a live shop."
        confirmLabel="Reset the demo"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          api('/demo/rewind', { method: 'POST' })
            .then(() => {
              toast.success('Demo reset. Refreshing the shop.');
              window.location.assign('/app');
            })
            .catch((err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Could not reset the demo'));
        }}
      />
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

