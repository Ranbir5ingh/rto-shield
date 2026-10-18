import { isDemoSession, toursFor } from './tours';

const spine = [
  'impact',
  'autopilot',
  'exceptions',
  'exception-order',
  'exception-action',
  'call-buyer',
  'activity',
] as const;

describe('demo session tour', () => {
  it('treats a demo role, a disposable demo, and the official demo account as a demo session', () => {
    expect(isDemoSession({ role: 'demo' })).toBe(true);
    expect(isDemoSession({ role: 'owner', isDemo: true })).toBe(true);
    expect(isDemoSession({ role: 'owner', officialDemo: true })).toBe(true);
    expect(isDemoSession({ role: 'owner' })).toBe(false);
    expect(isDemoSession(null)).toBe(false);
  });

  it('starts on results and reaches the connected store for the demo', () => {
    const steps = toursFor('demo', 'desktop');
    expect(steps.map((step) => step.id)).toEqual([
      ...spine,
      'shopify-connected',
      'whatsapp-card',
      'results-home',
    ]);
    const call = steps.find((step) => step.id === 'call-buyer');
    expect(call?.titleFromAnchor).toBe(true);
    expect(call?.title).toBe('Call the buyer');
    expect(call?.narrationId).toBe('call-buyer');
    expect(steps.some((step) => step.id === 'shopify-connect')).toBe(false);
    expect(steps.find((step) => step.id === 'shopify-connected')?.title).toBe('Shopify, connected');
    expect(steps[8]?.title).toBe('WhatsApp');
    expect(steps[8]?.body).toMatch(/RTO Shield/);
  });

  it('keeps Connect Shopify for a seller who has not connected', () => {
    const steps = toursFor('seller', 'desktop');
    expect(steps[0]?.id).toBe('impact');
    expect(steps[7]?.id).toBe('shopify-connect');
    expect(steps.some((step) => step.id === 'shopify-connected')).toBe(false);
    expect(steps[8]?.id).toBe('whatsapp-setup');
    expect(steps[8]?.title).toBe('WhatsApp');
    expect(steps[8]?.body).toMatch(/Optional/);
    expect(toursFor('seller', 'desktop', 'hindi')[8]?.body).toMatch(/RTO Shield/);
    expect(toursFor('seller', 'desktop', 'hinglish')[8]?.body).toMatch(/Optional/);
  });

  it('adapts the seller tour when Shopify is already connected', () => {
    const steps = toursFor('seller', 'mobile', 'english', { shopifyConnected: true });
    expect(steps[7]?.id).toBe('shopify-connected');
    expect(steps[7]?.title).toBe('Shopify, connected');
    expect(steps.some((step) => step.id === 'shopify-connect')).toBe(false);
    expect(steps.some((step) => step.id === 'whatsapp-setup')).toBe(true);
  });
});
