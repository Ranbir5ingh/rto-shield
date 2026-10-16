import { generateSample } from '../common/sample';
import { hourInKolkata } from '../common/hour';
import { scoreWithRules } from './rules-score';

function prepared() {
  return generateSample().map((order) => ({ ...order, hour: hourInKolkata(order.orderedAt) }));
}

describe('local rules score', () => {
  it('keeps sample returns near a third and lets some cash orders score low', () => {
    const orders = prepared();
    const history = orders.filter((order) => order.stage === 'history');
    const rto = history.filter((order) => order.outcome === 'rto').length / history.length;
    expect(rto).toBeGreaterThanOrEqual(0.22);
    expect(rto).toBeLessThanOrEqual(0.38);
    const result = scoreWithRules(orders);
    const cod = new Set(
      orders.filter((order) => order.stage === 'pending' && order.paymentType === 'cod').map((order) => order.externalOrderId),
    );
    expect(result.predictions.some((row) => cod.has(row.id) && row.band === 'Low')).toBe(true);
    expect(result.predictions.some((row) => row.band === 'Medium' || row.band === 'High')).toBe(true);
    expect(result.predictions.every((row) => row.reasons.length > 0)).toBe(true);
  });

  it('scores every pending sample order into a risk band', () => {
    const orders = prepared();
    const result = scoreWithRules(orders);
    const pending = orders.filter((order) => order.stage === 'pending');
    expect(result.model).toBe('rules-prior');
    expect(result.predictions).toHaveLength(pending.length);
    expect(result.predictions.every((row) => row.band === 'Low' || row.band === 'Medium' || row.band === 'High')).toBe(true);
    expect(result.predictions.some((row) => row.band === 'High' || row.band === 'Medium')).toBe(true);
    expect(result.predictions.every((row) => row.reasons.length > 0 && row.score >= 0 && row.score <= 100)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/phone|buyerName|9\d{9}/);
  });

  it('marks a junk cash-on-delivery first order higher than a prepaid repeat buyer', () => {
    const base = {
      externalOrderId: 'S0001',
      buyerName: 'Asha Mehra',
      phone: '9811111111',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      orderedAt: new Date('2026-01-01T12:00:00Z'),
      productName: 'Cotton kurti',
      courier: 'Delhivery',
      stage: 'pending' as const,
      outcome: null,
      hour: 14,
    };
    const risky = scoreWithRules([
      {
        ...base,
        address: 'xxx',
        orderValue: 2499,
        paymentType: 'cod',
        priorOrders: 0,
        priorRtos: 0,
        hour: 23,
      },
    ]);
    const calm = scoreWithRules([
      {
        ...base,
        externalOrderId: 'S0002',
        address: 'H.No 12, Lane 2, Shastri Nagar, Mumbai',
        orderValue: 499,
        paymentType: 'prepaid',
        priorOrders: 5,
        priorRtos: 0,
        hour: 14,
      },
    ]);
    expect(risky.predictions[0]!.score).toBeGreaterThan(calm.predictions[0]!.score);
    expect(risky.predictions[0]!.band).toBe('High');
    expect(calm.predictions[0]!.band).toBe('Low');
    expect(calm.predictions[0]!.reasons.join(' ')).not.toMatch(/junk/i);
  });

  it('plants a pending mix with low, medium, and high', () => {
    const orders = prepared();
    const result = scoreWithRules(orders);
    const counts = { Low: 0, Medium: 0, High: 0 };
    for (const row of result.predictions) counts[row.band] += 1;
    expect(counts).toEqual({ Low: 10, Medium: 8, High: 6 });
  });
});
