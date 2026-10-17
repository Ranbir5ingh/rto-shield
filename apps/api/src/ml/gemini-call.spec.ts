import { geminiCallFor } from './gemini-call';

describe('geminiCallFor', () => {
  it('uses the platform key when the shop has not saved one', () => {
    expect(geminiCallFor({ gemini: null }, () => 'platform')).toBeUndefined();
    expect(geminiCallFor({ gemini: { keyEnvelope: '', validatedAt: null } }, () => 'x')).toBeUndefined();
  });

  it('sends the seller key when one is saved', () => {
    expect(
      geminiCallFor({ gemini: { keyEnvelope: 'sealed', validatedAt: '2026-01-01' } }, () => 'seller-key'),
    ).toEqual({ mode: 'seller', key: 'seller-key' });
  });

  it('does not fall back to the platform key when the saved key will not open', () => {
    expect(
      geminiCallFor({ gemini: { keyEnvelope: 'sealed', validatedAt: '2026-01-01' } }, () => {
        throw new Error('bad seal');
      }),
    ).toEqual({ mode: 'seller', key: '' });
  });
});
