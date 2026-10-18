import { whatsappAllowlist } from './demo-send';
import { clientIp, demoAllows, demoCallWindow, effectiveRole, isDemoSession, isOfficialDemoAccount } from './demo.policy';

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

  it('keeps an owner login out of the demo session, including the official account', () => {
    expect(isDemoSession({ role: 'owner', $locals: { actor: 'demo' }, isDemo: false })).toBe(true);
    expect(isDemoSession({ role: 'demo' })).toBe(true);
    expect(isDemoSession({ role: 'owner', isDemo: true })).toBe(true);
    expect(isDemoSession({ role: 'owner', isDemo: false })).toBe(false);
    expect(isDemoSession({ role: 'staff' })).toBe(false);
    expect(isDemoSession(null)).toBe(false);
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
    expect(demoAllows('POST', '/api/orders/abc/extra-call')).toBe(false);
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
    expect(demoAllows('POST', '/api/demo/rewind')).toBe(true);
    expect(demoAllows('POST', '/api/shopify/disconnect')).toBe(false);
    expect(demoAllows('POST', '/api/orders/sample')).toBe(false);
    expect(demoAllows('POST', '/api/orders/import')).toBe(false);
    expect(demoAllows('GET', '/api/account/export')).toBe(false);
  });

  it('uses the browser IP marked by the web proxy, not the Vercel hop Express sees', () => {
    expect(clientIp('76.76.21.21', '76.76.21.21', '203.0.113.9')).toBe('203.0.113.9');
    expect(clientIp('76.76.21.21', '203.0.113.9, 76.76.21.21', '203.0.113.9, 76.76.21.21')).toBe('203.0.113.9');
    expect(clientIp('203.0.113.8', '198.51.100.4, 203.0.113.8')).toBe('203.0.113.8');
    expect(clientIp(undefined, '203.0.113.7')).toBe('203.0.113.7');
    expect(clientIp(undefined, undefined, undefined)).toBe('');
  });

  it('allows two demo calls per half hour for a session and for an IP', () => {
    const now = Date.parse('2026-10-18T12:00:00.000Z');
    const windowMs = 30 * 60 * 1000;
    expect(demoCallWindow({ now, sessionId: 's1', ipHash: 'ip1', calls: [] })).toMatchObject({
      remaining: 2,
      resetsAt: null,
    });
    const one = demoCallWindow({
      now,
      sessionId: 's1',
      ipHash: 'ip1',
      calls: [{ at: now - 5 * 60 * 1000, sessionId: 's1', ipHash: 'ip1' }],
    });
    expect(one.remaining).toBe(1);
    expect(one.resetsAt).toBe(new Date(now - 5 * 60 * 1000 + windowMs).toISOString());
    const fullSession = demoCallWindow({
      now,
      sessionId: 's1',
      ipHash: 'ip-new',
      calls: [
        { at: now - 10 * 60 * 1000, sessionId: 's1', ipHash: 'ip1' },
        { at: now - 60 * 1000, sessionId: 's1', ipHash: 'ip1' },
      ],
    });
    expect(fullSession.remaining).toBe(0);
    const fullIp = demoCallWindow({
      now,
      sessionId: 's2',
      ipHash: 'ip1',
      calls: [
        { at: now - 10 * 60 * 1000, sessionId: 's1', ipHash: 'ip1' },
        { at: now - 60 * 1000, sessionId: 'other', ipHash: 'ip1' },
      ],
    });
    expect(fullIp.remaining).toBe(0);
    const agedOut = demoCallWindow({
      now,
      sessionId: 's1',
      ipHash: 'ip1',
      calls: [{ at: now - windowMs - 1, sessionId: 's1', ipHash: 'ip1' }],
    });
    expect(agedOut.remaining).toBe(2);
    expect(agedOut.resetsAt).toBeNull();
  });

  it('normalises the WhatsApp allowlist', () => {
    expect(whatsappAllowlist('919800001111, 9800002222')).toEqual(['919800001111', '919800002222']);
  });
});
