export const ADDRESS_REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface AddressRequestShape {
  phone: string;
  conversation?: Array<{ at?: string; direction?: string; text?: string }>;
  timeline?: Array<{ at?: string; detail?: string }>;
}

/** When the shop last asked this order for an address, or null if it never did. */
export function addressRequestAt(order: AddressRequestShape): number | null {
  const times: number[] = [];
  for (const item of order.conversation || []) {
    if (item.direction !== 'out') continue;
    if (!/address_update_request/i.test(item.text || '')) continue;
    const at = Date.parse(item.at || '');
    if (Number.isFinite(at)) times.push(at);
  }
  for (const step of order.timeline || []) {
    if (!/asked the buyer to confirm the address/i.test(step.detail || '')) continue;
    const at = Date.parse(step.at || '');
    if (Number.isFinite(at)) times.push(at);
  }
  if (!times.length) return null;
  return Math.max(...times);
}

export function addressRequestIsOpen(order: AddressRequestShape, now = Date.now()): boolean {
  const at = addressRequestAt(order);
  if (at === null) return false;
  return at <= now && now - at <= ADDRESS_REPLY_WINDOW_MS;
}

/** Latest open address request for this phone. A reply that does not quote the template still belongs here. */
export function latestOpenAddressRequest<T extends AddressRequestShape>(orders: T[], phone: string, now = Date.now()): T | null {
  let best: { order: T; at: number } | null = null;
  for (const order of orders) {
    if (!phone || order.phone !== phone) continue;
    const at = addressRequestAt(order);
    if (at === null || at > now || now - at > ADDRESS_REPLY_WINDOW_MS) continue;
    if (!best || at > best.at) best = { order, at };
  }
  return best?.order || null;
}
