'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { SecretField } from '@/components/SecretField';
import { useToast } from '@/components/Toaster';
import { WhatsAppSetupGuide } from '@/components/WhatsAppGuide';
import { Button, Field, Notice, inputClass } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { qk, useGemini, useShopify, useWhatsapp, type GeminiLink, type ShopifyLink, type WhatsAppLink } from '@/lib/queries';

type ShopifyStatus = ShopifyLink;
type WhatsAppStatus = WhatsAppLink;

interface ConnectionCheck {
  id: string;
  ok: boolean;
  label: string;
  detail: string;
  hint: string;
}

type GeminiStatus = GeminiLink;

export function Connections({ locked = false }: { locked?: boolean }) {
  const client = useQueryClient();
  const shopifyQuery = useShopify();
  const whatsappQuery = useWhatsapp();
  const geminiQuery = useGemini();
  const [shopify, setShopify] = useState<ShopifyStatus | null>(null);
  const [whatsapp, setWhatsapp] = useState<WhatsAppStatus | null>(null);
  const [gemini, setGemini] = useState<GeminiStatus | null>(null);
  const toast = useToast();
  const [shop, setShop] = useState('');
  const [tokenDraft, setTokenDraft] = useState<string | null>(null);
  const [secretDraft, setSecretDraft] = useState<string | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [wabaError, setWabaError] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [testTo, setTestTo] = useState('');
  const [geminiDraft, setGeminiDraft] = useState<string | null>(null);
  const [geminiError, setGeminiError] = useState('');
  const [secretEpoch, setSecretEpoch] = useState(0);
  const [connectionChecks, setConnectionChecks] = useState<ConnectionCheck[] | null>(null);

  useEffect(() => {
    const body = shopifyQuery.data;
    if (!body) return;
    setShopify((current) =>
      current
        ? { ...current, connected: body.connected, demo: body.demo, shop: body.shop, backfill: body.backfill }
        : body,
    );
  }, [shopifyQuery.data]);

  useEffect(() => {
    const body = whatsappQuery.data;
    if (!body) return;
    setWhatsapp(body);
    setPhoneNumberId((current) => current || body.phoneNumberId || '');
    setWabaId((current) => current || body.wabaId || '');
  }, [whatsappQuery.data]);

  useEffect(() => {
    if (geminiQuery.data) setGemini(geminiQuery.data);
  }, [geminiQuery.data]);

  function rememberShopify(body: ShopifyStatus) {
    setShopify(body);
    client.setQueryData(qk.shopify, body);
  }

  function rememberWhatsapp(body: WhatsAppStatus) {
    setWhatsapp(body);
    client.setQueryData(qk.whatsapp, body);
  }

  function rememberGemini(body: GeminiStatus) {
    setGemini(body);
    client.setQueryData(qk.gemini, body);
  }

  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save that connection');
    }
  }

  if (locked) {
    return (
      <div className="space-y-4">
        <section className="panel space-y-2 p-5 shadow-card">
          <h2 className="font-display text-2xl">Shopify</h2>
          <p className="text-sm text-ink/70">{shopify?.connected ? shopify.shop || 'Connected' : 'Not connected'}</p>
        </section>
        <section className="panel space-y-2 p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-2xl">WhatsApp</h2>
            <WhatsAppSetupGuide
              callbackUrl={whatsapp?.callbackUrl || ''}
              verifyToken=""
              progress={{ templateStatus: whatsapp?.templateStatus, webhookVerified: whatsapp?.webhookVerified }}
            />
          </div>
          <p className="text-sm text-ink/70">
            {whatsapp?.configured ? 'Saved · ••••••••' : 'Not configured'}
            {whatsapp?.templateStatus ? ` · template ${whatsapp.templateStatus}` : ''}
          </p>
        </section>
        <section className="panel space-y-2 p-5 shadow-card">
          <h2 className="font-display text-2xl">Gemini</h2>
          <p className="text-sm text-ink/70">{gemini?.configured ? 'Saved · ••••••••' : 'Not configured'}</p>
        </section>
        <p className="text-sm leading-6 text-ink/70">Demo sessions can look, not change the shop.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="panel space-y-3 p-5 shadow-card">
        <h2 className="font-display text-2xl">Shopify</h2>
        {shopify?.connected ? (
          <>
            <p className="text-sm text-ink/70">
              {shopify.demo ? 'Demo store' : shopify.shop} · backfill {shopify.backfill.status} ({shopify.backfill.processed})
            </p>
            {shopify.backfill.status === 'error' ? (
              <Notice>{shopify.backfill.error || 'Shopify could not finish the import.'}</Notice>
            ) : null}
          </>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const body = await api<{ url: string }>('/shopify/install', { method: 'POST', body: JSON.stringify({ shop }) });
                window.location.assign(body.url);
              });
            }}
          >
            <Field label="Shop domain">
              <input className={inputClass} value={shop} onChange={(event) => setShop(event.target.value)} placeholder="your-store.myshopify.com" />
            </Field>
            <Button type="submit">Connect Shopify</Button>
          </form>
        )}
        {shopify?.connected && !shopify.demo ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const body = await api<ShopifyStatus>('/shopify/settings', {
                  method: 'POST',
                  body: JSON.stringify({
                    rtoTag: shopify.rtoTag,
                    autoCancelOnBuyerCancel: shopify.autoCancelOnBuyerCancel,
                    riskTags: shopify.riskTags,
                  }),
                });
                rememberShopify(body);
                toast.success('Shopify settings saved.');
              });
            }}
          >
            <Field label="Tag that means RTO in your shop">
              <input className={inputClass} value={shopify.rtoTag} onChange={(event) => setShopify({ ...shopify, rtoTag: event.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={shopify.autoCancelOnBuyerCancel}
                onChange={(event) => setShopify({ ...shopify, autoCancelOnBuyerCancel: event.target.checked })}
              />
              Cancel the Shopify order when the buyer taps Cancel
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Save Shopify</Button>
              <Button
                type="button"
                tone="ghost"
                onClick={() =>
                  void run(async () => {
                    rememberShopify(await api<ShopifyStatus>('/shopify/resync', { method: 'POST' }));
                    toast.info('Resync started.');
                  })
                }
              >
                Resync 60 days
              </Button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="panel space-y-3 p-5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl">WhatsApp</h2>
          <WhatsAppSetupGuide
            callbackUrl={whatsapp?.callbackUrl || ''}
            verifyToken={whatsapp?.verifyToken || ''}
            progress={{
              phoneNumberId: whatsapp?.phoneNumberId,
              wabaId: whatsapp?.wabaId,
              tokenLast4: whatsapp?.tokenLast4,
              appSecretLast4: whatsapp?.appSecretLast4,
              templateStatus: whatsapp?.templateStatus,
              webhookVerified: whatsapp?.webhookVerified,
            }}
          />
        </div>
        <p className="text-sm leading-6 text-ink/70">Your own Cloud API number. Templates only, until the buyer replies.</p>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const phoneOk = /^\d{6,30}$/.test(phoneNumberId.trim());
            const wabaOk = /^\d{6,30}$/.test(wabaId.trim());
            setPhoneError(phoneOk ? '' : 'Phone Number ID should be numeric.');
            setWabaError(wabaOk ? '' : 'WABA ID should be numeric.');
            const tokenMissing = !whatsapp?.tokenLast4 && !(tokenDraft && tokenDraft.trim().length >= 20);
            setTokenError(tokenMissing ? 'Paste the permanent access token.' : '');
            if (!phoneOk || !wabaOk || tokenMissing) return;
            void run(async () => {
              const payload: { accessToken?: string; phoneNumberId: string; wabaId: string; appSecret?: string } = {
                phoneNumberId: phoneNumberId.trim(),
                wabaId: wabaId.trim(),
              };
              if (tokenDraft?.trim()) payload.accessToken = tokenDraft.trim();
              if (secretDraft?.trim()) payload.appSecret = secretDraft.trim();
              const body = await api<WhatsAppStatus>('/whatsapp', { method: 'POST', body: JSON.stringify(payload) });
              rememberWhatsapp(body);
              setTokenDraft(null);
              setSecretDraft(null);
              setSecretEpoch((current) => current + 1);
              toast.success('WhatsApp saved.');
            });
          }}
        >
          <SecretField
            key={`whatsapp-token-${secretEpoch}`}
            label="Permanent access token"
            field="whatsappToken"
            last4={whatsapp?.tokenLast4 || ''}
            draft={tokenDraft}
            onDraftChange={setTokenDraft}
            error={tokenError}
          />
          <Field label="Phone Number ID" error={phoneError}>
            <input className={inputClass} value={phoneNumberId} onChange={(event) => setPhoneNumberId(event.target.value)} inputMode="numeric" />
          </Field>
          <Field label="WABA ID" error={wabaError}>
            <input className={inputClass} value={wabaId} onChange={(event) => setWabaId(event.target.value)} inputMode="numeric" />
          </Field>
          <SecretField
            key={`whatsapp-secret-${secretEpoch}`}
            label="App secret, optional but required for replies"
            field="whatsappAppSecret"
            last4={whatsapp?.appSecretLast4 || ''}
            draft={secretDraft}
            onDraftChange={setSecretDraft}
          />
          <Button type="submit">Save WhatsApp</Button>
        </form>
        {whatsapp ? (
          <div className="space-y-2 text-sm">
            <p>Template order_confirmation: {whatsapp.templateStatus}</p>
            <p className="break-all font-mono text-xs">Callback {whatsapp.callbackUrl}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() =>
                  void run(async () => {
                    const body = await api<{ ok: boolean; checks: ConnectionCheck[] }>('/whatsapp/test-connection', { method: 'POST' });
                    setConnectionChecks(body.checks);
                    const fresh = await api<WhatsAppStatus>('/whatsapp');
                    rememberWhatsapp(fresh);
                    toast[body.ok ? 'success' : 'info'](
                      body.ok ? 'WhatsApp connection looks ready.' : 'WhatsApp still needs a fix. The checks are listed below.',
                    );
                  })
                }
              >
                Test connection
              </Button>
              <Button
                type="button"
                tone="ghost"
                onClick={() =>
                  void run(async () => {
                    rememberWhatsapp(await api<WhatsAppStatus>('/whatsapp/template', { method: 'POST' }));
                    toast.success('Template submitted. Approval can take a few minutes.');
                  })
                }
              >
                Submit template
              </Button>
              <Button
                type="button"
                tone="ghost"
                onClick={() =>
                  void run(async () => {
                    rememberWhatsapp(await api<WhatsAppStatus>('/whatsapp/template'));
                    toast.info('Template status refreshed.');
                  })
                }
              >
                Refresh status
              </Button>
            </div>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await api('/whatsapp/test', { method: 'POST', body: JSON.stringify({ to: testTo }) });
                  toast.success('Test sent with the hello_world template.');
                });
              }}
            >
              <Field label="Send test to">
                <input className={inputClass} value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder="98xxxxxxxx" />
              </Field>
              <Button type="submit">Send test message</Button>
            </form>
            {connectionChecks ? (
              <ul className="space-y-2">
                {connectionChecks.map((check) => (
                  <li key={check.id} className={`sticker-sm px-4 py-3 ${check.ok ? '!bg-lime/30' : '!bg-hl/40'}`}>
                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]">
                      {check.ok ? 'Ready' : 'Needs a fix'} · {check.label}
                    </p>
                    <p className="mt-1 text-sm leading-6">{check.detail}</p>
                    {check.ok ? null : <p className="mt-1 text-sm leading-6 text-ink/75">{check.hint}</p>}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="panel space-y-3 p-5 shadow-card">
        <h2 className="font-display text-2xl">Gemini</h2>
        <p className="text-sm leading-6 text-ink/70">
          Notes for this shop use your key.
          {gemini?.demoFallback ? ' The demo shop can use the platform key.' : ''}
        </p>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const next = geminiDraft?.trim() || '';
            if (!gemini?.last4 && next.length < 20) {
              setGeminiError('Paste the AI Studio key.');
              return;
            }
            setGeminiError('');
            if (!next) {
              toast.info('The saved key stays in place.');
              return;
            }
            void run(async () => {
              const body = await api<GeminiStatus>('/gemini', { method: 'POST', body: JSON.stringify({ apiKey: next }) });
              rememberGemini(body);
              setGeminiDraft(null);
              setSecretEpoch((current) => current + 1);
              toast.success('Gemini key checked and sealed.');
            });
          }}
        >
          <SecretField
            key={`gemini-${secretEpoch}`}
            label="AI Studio key"
            field="geminiKey"
            last4={gemini?.last4 || ''}
            draft={geminiDraft}
            onDraftChange={setGeminiDraft}
            error={geminiError}
          />
          <Button type="submit">Test and save</Button>
        </form>
      </section>
    </div>
  );
}
