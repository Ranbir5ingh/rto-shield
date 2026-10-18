'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { SecretField } from '@/components/SecretField';
import { useToast } from '@/components/Toaster';
import { WhatsAppSetupGuide } from '@/components/WhatsAppGuide';
import { Button, Field, Flag, Notice, inputClass } from '@/components/ui';
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

function Card({
  title,
  desc,
  flag,
  guide,
  children,
}: {
  title: string;
  desc: string;
  flag: React.ReactNode;
  guide?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-2 border-ink bg-white shadow-sticker-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-ink px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="font-display text-lg font-extrabold uppercase tracking-tight">{title}</h3>
            {guide}
          </div>
          <p className="mt-1 text-sm leading-6 text-ink/70">{desc}</p>
        </div>
        <div className="shrink-0">{flag}</div>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </div>
  );
}

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
        {[
          ['Shopify', shopify?.connected ? shopify.shop || 'Connected' : 'Not connected'],
          ['WhatsApp', whatsapp?.configured ? 'Your number · ••••••••' : 'Platform number'],
          ['Gemini', gemini?.configured ? 'Saved · ••••••••' : 'Not configured'],
        ].map(([title, state]) => (
          <div key={title} className="flex items-center justify-between gap-4 border-2 border-ink bg-white px-5 py-4 shadow-sticker-sm">
            <h3 className="font-display text-lg font-extrabold uppercase tracking-tight">{title}</h3>
            <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-inksoft">{state}</span>
          </div>
        ))}
        <p className="text-sm leading-6 text-ink/70">Demo sessions can look, not change the shop.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card
        title="Shopify"
        desc="Pulls the last 60 days of orders and keeps scoring new ones."
        flag={<Flag tone={shopify?.connected ? 'go' : 'ghost'}>{shopify?.connected ? 'Connected' : 'Not connected'}</Flag>}
      >
        {shopify?.connected ? (
          <>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em]">
              {shopify.demo ? 'Demo store' : shopify.shop} · backfill {shopify.backfill.status} ({shopify.backfill.processed})
            </p>
            {shopify.backfill.status === 'error' ? (
              <Notice>{shopify.backfill.error || 'Shopify could not finish the import.'}</Notice>
            ) : null}
          </>
        ) : (
          <form
            className="max-w-sm space-y-4"
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
            className="max-w-md space-y-4 border-t-2 border-dashed border-ink/20 pt-4"
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
            <p className="eyebrow text-inksoft">Shopify preferences</p>
            <Field label="Tag that means RTO in your shop">
              <input className={inputClass} value={shopify.rtoTag} onChange={(event) => setShopify({ ...shopify, rtoTag: event.target.value })} />
            </Field>
            <label className="flex items-center gap-3 border-2 border-ink bg-paper px-4 py-3.5">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#1B1712]"
                checked={shopify.autoCancelOnBuyerCancel}
                onChange={(event) => setShopify({ ...shopify, autoCancelOnBuyerCancel: event.target.checked })}
              />
              <span className="text-[15px]">Cancel the Shopify order when the buyer taps Cancel</span>
            </label>
            <div className="flex flex-wrap gap-2.5">
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
      </Card>

      <Card
        title="WhatsApp"
        desc="Optional. RTO Shield's number is the default. Connect yours if buyers should see the shop."
        flag={<Flag tone={whatsapp?.configured ? 'go' : 'ghost'}>{whatsapp?.configured ? 'Your number' : 'Platform number'}</Flag>}
        guide={
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
        }
      >
        <form
          className="grid max-w-2xl gap-4 sm:grid-cols-2"
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
          <div className="sm:col-span-2">
            <SecretField
              key={`whatsapp-token-${secretEpoch}`}
              label="Permanent access token"
              field="whatsappToken"
              last4={whatsapp?.tokenLast4 || ''}
              draft={tokenDraft}
              onDraftChange={setTokenDraft}
              error={tokenError}
            />
          </div>
          <Field label="Phone Number ID" error={phoneError}>
            <input className={inputClass} value={phoneNumberId} onChange={(event) => setPhoneNumberId(event.target.value)} inputMode="numeric" />
          </Field>
          <Field label="WABA ID" error={wabaError}>
            <input className={inputClass} value={wabaId} onChange={(event) => setWabaId(event.target.value)} inputMode="numeric" />
          </Field>
          <div className="sm:col-span-2">
            <SecretField
              key={`whatsapp-secret-${secretEpoch}`}
              label="App secret, for replies on your own number"
              field="whatsappAppSecret"
              last4={whatsapp?.appSecretLast4 || ''}
              draft={secretDraft}
              onDraftChange={setSecretDraft}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Save WhatsApp</Button>
          </div>
        </form>
        {whatsapp ? (
          <div className="space-y-3 border-t-2 border-dashed border-ink/20 pt-4">
            <p className="eyebrow text-inksoft">Diagnostics</p>
            <p className="text-sm">Template order_confirmation: <span className="font-mono text-xs font-bold">{whatsapp.templateStatus}</span></p>
            <p className="break-all font-mono text-xs text-inksoft">Callback {whatsapp.callbackUrl}</p>
            <div className="flex flex-wrap gap-2.5">
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
              className="flex max-w-md flex-wrap items-end gap-2.5"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await api('/whatsapp/test', { method: 'POST', body: JSON.stringify({ to: testTo }) });
                  toast.success('Test sent with the hello_world template.');
                });
              }}
            >
              <div className="min-w-0 flex-1">
                <Field label="Send test to">
                  <input className={inputClass} value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder="98xxxxxxxx" />
                </Field>
              </div>
              <Button type="submit">Send test</Button>
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
      </Card>

      <Card
        title="Gemini"
        desc="Notes for this shop use your key."
        flag={<Flag tone={gemini?.configured ? 'go' : 'ghost'}>{gemini?.configured ? 'Saved' : 'Not configured'}</Flag>}
      >
        {gemini?.demoFallback ? <p className="text-sm leading-6 text-ink/70">The demo shop can use the platform key.</p> : null}
        <form
          className="max-w-sm space-y-4"
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
      </Card>
    </div>
  );
}
