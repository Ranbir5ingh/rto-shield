import { isDemoSession, toursFor } from './tours';

const nine = [
  'impact',
  'autopilot',
  'exceptions',
  'exception-order',
  'exception-action',
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
      ...nine,
      'shopify-connected',
      'whatsapp-card',
      'results-home',
    ]);
    expect(steps.some((step) => step.id === 'shopify-connect')).toBe(false);
    expect(steps.find((step) => step.id === 'shopify-connected')?.title).toBe('Shopify, connected');
  });

  it('keeps Connect Shopify for a seller who has not connected', () => {
    const steps = toursFor('seller', 'desktop');
    expect(steps[0]?.id).toBe('impact');
    expect(steps[6]?.id).toBe('shopify-connect');
    expect(steps.some((step) => step.id === 'shopify-connected')).toBe(false);
    expect(steps.some((step) => step.id === 'whatsapp-setup')).toBe(true);
  });

  it('adapts the seller tour when Shopify is already connected', () => {
    const steps = toursFor('seller', 'mobile', 'english', { shopifyConnected: true });
    expect(steps[6]?.id).toBe('shopify-connected');
    expect(steps[6]?.title).toBe('Shopify, connected');
    expect(steps.some((step) => step.id === 'shopify-connect')).toBe(false);
    expect(steps.some((step) => step.id === 'whatsapp-setup')).toBe(true);
  });
});
