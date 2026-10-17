'use client';

import { useEffect, useState } from 'react';
import { Button, Field, Notice, inputClass } from '@/components/ui';
import { ApiError, api } from '@/lib/api';

interface ShopifyStatus {
  connected: boolean;
  demo: boolean;
  shop: string | null;
  backfill: { status: string; processed: number; total: number; error: string | null };
  rtoTag: string;
  autoCancelOnBuyerCancel: boolean;
  riskTags: { high: string; medium: string; low: string };
}

interface WhatsAppStatus {
  configured: boolean;
  demo: boolean;
  phoneNumberId: string;
  wabaId: string;
  tokenLast4: string;
  appSecretLast4: string;
  templateStatus: string;
  callbackUrl: string;
  verifyTokenName: string;
}

interface GeminiStatus {
  configured: boolean;
  last4: string;
  validatedAt: string | null;
  demoFallback: boolean;
}

export function Connections() {
  const [shopify, setShopify] = useState<ShopifyStatus | null>(null);
  const [whatsapp, setWhatsapp] = useState<WhatsAppStatus | null>(null);
  const [gemini, setGemini] = useState<GeminiStatus | null>(null);
  const [shop, setShop] = useState('');
  const [token, setToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [testTo, setTestTo] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const [shopBody, waBody, gemBody] = await Promise.all([
      api<ShopifyStatus>('/shopify'),
      api<WhatsAppStatus>('/whatsapp'),
      api<GeminiStatus>('/gemini'),
    ]);
    setShopify(shopBody);
    setWhatsapp(waBody);
    setGemini(gemBody);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function run(action: () => Promise<void>) {
    setError('');
    setMessage('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save that connection');
    }
  }

  return (
    <div className="space-y-4">
      {message ? <Notice tone="good">{message}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
      <section className="panel space-y-3 p-5 shadow-card">
        <h2 className="font-display text-2xl">Shopify</h2>
        {shopify?.connected ? (
          <p className="text-sm text-ink/70">
            {shopify.demo ? 'Demo store' : shopify.shop} · backfill {shopify.backfill.status} ({shopify.backfill.processed})
          </p>
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
                setShopify(body);
                setMessage('Shopify settings saved.');
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
                    setShopify(await api<ShopifyStatus>('/shopify/resync', { method: 'POST' }));
                    setMessage('Resync started.');
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
        <h2 className="font-display text-2xl">WhatsApp</h2>
        <p className="text-sm leading-6 text-ink/70">
          Your own Cloud API number. Templates only, until the buyer replies. Last 4 of the token: {whatsapp?.tokenLast4 || 'none'}.
        </p>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const body = await api<WhatsAppStatus>('/whatsapp', {
                method: 'POST',
                body: JSON.stringify({
                  accessToken: token,
                  phoneNumberId,
                  wabaId,
                  appSecret: appSecret || undefined,
                }),
              });
              setWhatsapp(body);
              setToken('');
              setAppSecret('');
              setMessage('WhatsApp saved. The token is stored sealed.');
            });
          }}
        >
          <Field label="Permanent access token">
            <input className={inputClass} type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" />
          </Field>
          <Field label="Phone Number ID">
            <input className={inputClass} value={phoneNumberId} onChange={(event) => setPhoneNumberId(event.target.value)} inputMode="numeric" />
          </Field>
          <Field label="WABA ID">
            <input className={inputClass} value={wabaId} onChange={(event) => setWabaId(event.target.value)} inputMode="numeric" />
          </Field>
          <Field label="App secret, optional but required for replies">
            <input className={inputClass} type="password" value={appSecret} onChange={(event) => setAppSecret(event.target.value)} autoComplete="off" />
          </Field>
          <Button type="submit">Save WhatsApp</Button>
        </form>
        {whatsapp ? (
          <div className="space-y-2 text-sm">
            <p>Template order_confirmation: {whatsapp.templateStatus}</p>
            <p className="break-all font-mono text-xs">Callback {whatsapp.callbackUrl}</p>
            <p className="font-mono text-xs">Verify token env {whatsapp.verifyTokenName}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                tone="ghost"
                onClick={() =>
                  void run(async () => {
                    setWhatsapp(await api<WhatsAppStatus>('/whatsapp/template', { method: 'POST' }));
                    setMessage('Template submitted. Approval can take a few minutes.');
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
                    setWhatsapp(await api<WhatsAppStatus>('/whatsapp/template'));
                    setMessage('Template status refreshed.');
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
                  setMessage('Test sent with the hello_world template.');
                });
              }}
            >
              <Field label="Send test to">
                <input className={inputClass} value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder="98xxxxxxxx" />
              </Field>
              <Button type="submit">Send test message</Button>
            </form>
          </div>
        ) : null}
      </section>

      <section className="panel space-y-3 p-5 shadow-card">
        <h2 className="font-display text-2xl">Gemini</h2>
        <p className="text-sm leading-6 text-ink/70">
          Notes for this shop use your key. Last 4: {gemini?.last4 || 'none'}.
          {gemini?.demoFallback ? ' The demo shop can use the platform key.' : ''}
        </p>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const body = await api<GeminiStatus>('/gemini', { method: 'POST', body: JSON.stringify({ apiKey: geminiKey }) });
              setGemini(body);
              setGeminiKey('');
              setMessage('Gemini key checked and sealed.');
            });
          }}
        >
          <Field label="AI Studio key">
            <input className={inputClass} type="password" value={geminiKey} onChange={(event) => setGeminiKey(event.target.value)} autoComplete="off" />
          </Field>
          <Button type="submit">Test and save</Button>
        </form>
      </section>
    </div>
  );
}
