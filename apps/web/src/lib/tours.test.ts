import { isDemoSession, toursFor } from './tours';

describe('demo session tour', () => {
  it('treats a demo role, a disposable demo, and the official demo account as a demo session', () => {
    expect(isDemoSession({ role: 'demo' })).toBe(true);
    expect(isDemoSession({ role: 'owner', isDemo: true })).toBe(true);
    expect(isDemoSession({ role: 'owner', officialDemo: true })).toBe(true);
    expect(isDemoSession({ role: 'owner' })).toBe(false);
    expect(isDemoSession(null)).toBe(false);
  });

  it('starts the demo tour on the connected store', () => {
    const steps = toursFor('demo', 'desktop');
    expect(steps[0]?.id).toBe('shopify-connected');
    expect(steps.some((step) => step.id === 'shopify-connect')).toBe(false);
  });

  it('keeps Connect Shopify for a seller who has not connected', () => {
    const steps = toursFor('seller', 'desktop');
    expect(steps[0]?.id).toBe('shopify-connect');
  });

  it('adapts the seller tour when Shopify is already connected', () => {
    const steps = toursFor('seller', 'mobile', 'english', { shopifyConnected: true });
    expect(steps[0]?.id).toBe('shopify-connected');
    expect(steps[0]?.title).toBe('Shopify, connected');
    expect(steps.some((step) => step.id === 'shopify-connect')).toBe(false);
    expect(steps.some((step) => step.id === 'import-alternatives')).toBe(true);
    expect(steps.some((step) => step.id === 'whatsapp-setup')).toBe(true);
  });
});
