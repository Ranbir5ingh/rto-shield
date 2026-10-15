import { generateSample } from './sample';

describe('sample generator', () => {
  it('makes COD more likely to be RTO than prepaid', () => {
    const rows = generateSample(42).filter((row) => row.stage === 'history');
    const rate = (kind: 'cod' | 'prepaid') => {
      const subset = rows.filter((row) => row.paymentType === kind);
      return subset.filter((row) => row.outcome === 'rto').length / subset.length;
    };
    expect(rate('cod')).toBeGreaterThan(rate('prepaid') + 0.1);
    expect(rows.length).toBe(360);
  });
});
