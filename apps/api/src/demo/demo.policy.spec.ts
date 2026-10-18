import { whatsappAllowlist } from './demo-send';
import { demoAllows, effectiveRole, isOfficialDemoAccount } from './demo.policy';

describe('demo policy', () => {
  const previous = process.env.DEMO_ACCOUNT_EMAIL;

  afterEach(() => {
    if (previous === undefined) delete process.env.DEMO_ACCOUNT_EMAIL;
    else process.env.DEMO_ACCOUNT_EMAIL = previous;
  });

  it('treats a visitor session as demo without trusting a stored owner role', () => {
    expect(effectiveRole({ role: 'owner', $locals: { actor: 'demo' } })).toBe('demo');
    expect(effectiveRole({ role: 'staff' })).toBe('staff');
    expect(effectiveRole({ role: 'owner' })).toBe('owner');
  });

  it('matches the official demo account only from the env email', () => {
    process.env.DEMO_ACCOUNT_EMAIL = 'Ranbirsingh.code+e2e1@gmail.com';
    expect(isOfficialDemoAccount('ranbirsingh.code+e2e1@gmail.com')).toBe(true);
    expect(isOfficialDemoAccount('other@shop.test')).toBe(false);
    delete process.env.DEMO_ACCOUNT_EMAIL;
    expect(isOfficialDemoAccount('ranbirsingh.code+e2e1@gmail.com')).toBe(false);
  });

  it('lets a demo session view, decide, and rescore, and blocks shop changes', () => {
    expect(demoAllows('GET', '/api/whatsapp')).toBe(true);
    expect(demoAllows('GET', '/api/orders')).toBe(true);
    expect(demoAllows('PATCH', '/api/orders/abc/outcome')).toBe(true);
    expect(demoAllows('POST', '/api/orders/score')).toBe(true);
    expect(demoAllows('POST', '/api/orders/abc/prepaid')).toBe(true);
    expect(demoAllows('POST', '/api/orders/abc/address')).toBe(true);
    expect(demoAllows('POST', '/api/orders/abc/call')).toBe(true);
    expect(demoAllows('POST', '/api/orders/abc/escalate')).toBe(true);
    expect(demoAllows('POST', '/api/elevenlabs')).toBe(false);
    expect(demoAllows('POST', '/api/whatsapp/send')).toBe(true);
    expect(demoAllows('POST', '/api/whatsapp/test-allowlist')).toBe(false);
    expect(demoAllows('POST', '/api/whatsapp/verify-token')).toBe(false);
    expect(demoAllows('POST', '/api/settings/secrets/reveal')).toBe(false);
    expect(demoAllows('POST', '/api/whatsapp')).toBe(false);
    expect(demoAllows('POST', '/api/whatsapp/test-connection')).toBe(false);
    expect(demoAllows('POST', '/api/shopify/install')).toBe(false);
    expect(demoAllows('POST', '/api/shopify/settings')).toBe(false);
    expect(demoAllows('POST', '/api/shopify/resync')).toBe(false);
    expect(demoAllows('DELETE', '/api/elevenlabs')).toBe(false);
    expect(demoAllows('PATCH', '/api/account/settings')).toBe(false);
    expect(demoAllows('DELETE', '/api/account/data')).toBe(false);
    expect(demoAllows('DELETE', '/api/account')).toBe(false);
    expect(demoAllows('POST', '/api/gemini')).toBe(false);
    expect(demoAllows('DELETE', '/api/gemini')).toBe(false);
    expect(demoAllows('POST', '/api/orders/sample')).toBe(false);
    expect(demoAllows('POST', '/api/orders/import')).toBe(false);
    expect(demoAllows('GET', '/api/account/export')).toBe(false);
  });

  it('normalises the WhatsApp allowlist', () => {
    expect(whatsappAllowlist('919800001111, 9800002222')).toEqual(['919800001111', '919800002222']);
  });
});
