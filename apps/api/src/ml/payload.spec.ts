import { toMlOrder, trainingLabel } from './payload';

describe('trainingLabel', () => {
  it('learns only from delivered, rto, and cancelled', () => {
    expect(trainingLabel('delivered')).toBe(0);
    expect(trainingLabel('rto')).toBe(1);
    expect(trainingLabel('cancelled')).toBe(1);
    expect(trainingLabel('confirmed')).toBeUndefined();
    expect(trainingLabel('converted')).toBeUndefined();
    expect(trainingLabel(null)).toBeUndefined();
  });

  it('omits the label when the outcome is an app decision', () => {
    const payload = toMlOrder({
      id: '1',
      orderValue: 100,
      paymentType: 'cod',
      hour: 12,
      priorOrders: 0,
      priorRtos: 0,
      address: 'H.No 1',
      city: 'Pune',
      state: 'MH',
      pincode: '411001',
      outcome: 'confirmed',
    });
    expect(payload).not.toHaveProperty('label');
  });
});
