import { addressRequestIsOpen, latestOpenAddressRequest } from './address-match';

const phone = '919800000001';

function order(at: string, extra?: { phone?: string; text?: string }) {
  return {
    id: at,
    phone: extra?.phone || phone,
    conversation: [{ at, direction: 'out' as const, text: extra?.text || 'address_update_request 1001' }],
  };
}

describe('address reply matching', () => {
  const now = Date.parse('2026-10-18T08:00:00.000Z');

  it('keeps a plain reply on the latest open address request for that phone', () => {
    const older = order(new Date(now - 2 * 60 * 60 * 1000).toISOString(), { text: 'address_update_request older' });
    const latest = order(new Date(now - 10 * 60 * 1000).toISOString());
    const other = order(new Date(now - 5 * 60 * 1000).toISOString(), { phone: '919800000099' });
    const stale = order(new Date(now - 25 * 60 * 60 * 1000).toISOString());
    const confirmation = order(new Date(now - 5 * 60 * 1000).toISOString(), { text: 'order_confirmation 1001' });
    expect(latestOpenAddressRequest([older, stale, other, confirmation, latest], phone, now)).toBe(latest);
    expect(addressRequestIsOpen(stale, now)).toBe(false);
    expect(addressRequestIsOpen(latest, now)).toBe(true);
    expect(latestOpenAddressRequest([stale], phone, now)).toBeNull();
    expect(latestOpenAddressRequest([confirmation], phone, now)).toBeNull();
  });
});
