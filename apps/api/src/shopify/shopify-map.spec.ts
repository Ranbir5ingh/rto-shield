import { backfillSince, shopifyOutcomeUpdate, staleRiskTags } from './shopify-map';

describe('shopify order merge', () => {
  it('takes a real courier outcome and ignores an open resync', () => {
    expect(shopifyOutcomeUpdate('delivered')).toEqual({ stage: 'history', outcome: 'delivered' });
    expect(shopifyOutcomeUpdate('rto')).toEqual({ stage: 'history', outcome: 'rto' });
    expect(shopifyOutcomeUpdate('cancelled')).toEqual({ stage: 'history', outcome: 'cancelled' });
    expect(shopifyOutcomeUpdate(null)).toBeNull();
  });

  it('defaults the backfill window to 180 days and honours an override', () => {
    const now = Date.parse('2026-10-17T00:00:00.000Z');
    expect(backfillSince(now, '')).toBe('2026-04-20');
    expect(backfillSince(now, '60')).toBe('2026-08-18');
  });

  it('removes the other rto tags before writing the current band', () => {
    const tags = staleRiskTags({ high: 'rto-high', medium: 'rto-medium', low: 'rto-low' }, 'Low');
    expect(tags.add).toBe('rto-low');
    expect(tags.remove).toEqual(['rto-high', 'rto-medium']);
  });
});
