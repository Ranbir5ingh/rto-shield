import { chooseIntervention, DEFAULT_REDUCTION, reductionSettings } from './action';

const base = {
  paymentType: 'cod' as const,
  riskScore: 50,
  riskBand: 'Medium' as const,
  reasons: ['Cash on delivery from a first-time buyer'],
  priorRtos: 0,
  addressQuality: { incomplete: false, landmark_only: false, junk: false, pincode_mismatch: false },
  settings: DEFAULT_REDUCTION,
};

describe('chooseIntervention', () => {
  it('holds a repeat refuser or a fake pattern', () => {
    expect(chooseIntervention({ ...base, priorRtos: 2 }).action).toBe('hold_review');
    expect(chooseIntervention({ ...base, reasons: ['Looks like a fake order'] }).action).toBe('hold_review');
  });

  it('asks for a landmark when the address is weak', () => {
    const choice = chooseIntervention({ ...base, addressQuality: { ...base.addressQuality, incomplete: true }, riskBand: 'Low', riskScore: 10 });
    expect(choice.action).toBe('request_address');
    expect(choice.why).toMatch(/landmark/i);
  });

  it('offers prepaid on a high-risk COD order', () => {
    const choice = chooseIntervention({ ...base, riskBand: 'High', riskScore: 81 });
    expect(choice.action).toBe('offer_prepaid');
    expect(choice.why).toMatch(/5%/);
  });

  it('auto-confirms a complete low-risk order', () => {
    expect(chooseIntervention({ ...base, riskBand: 'Low', riskScore: 12 }).action).toBe('auto_confirm');
  });

  it('falls back to a WhatsApp confirm', () => {
    expect(chooseIntervention({ ...base, paymentType: 'prepaid', riskBand: 'Medium', riskScore: 48 }).action).toBe('confirm');
  });

  it('reads seller reduction settings with defaults', () => {
    expect(reductionSettings({})).toEqual(DEFAULT_REDUCTION);
    expect(reductionSettings({ reduction: { prepaidEnabled: false, discountPct: 12, minRisk: 70, escalationMinutes: 30 } }).prepaidEnabled).toBe(false);
    expect(reductionSettings({}).autopilot).toBe(true);
    expect(reductionSettings({ reduction: { noReply: 'cancel' } }).noReply).toBe('cancel');
  });
});
