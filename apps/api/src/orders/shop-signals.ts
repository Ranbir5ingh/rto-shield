/** Shop-local signals. Phone digits never leave this process. The pin code is not a model feature. */

export function phoneKey(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

export interface Tally {
  n: number;
  rtos: number;
}

function isReturn(outcome: string | null): boolean {
  return outcome === 'rto' || outcome === 'cancelled';
}

function isLabelled(outcome: string | null): boolean {
  return outcome === 'delivered' || outcome === 'rto' || outcome === 'cancelled';
}

export function pinLedger(rows: Array<{ pincode: string; outcome: string | null }>): Map<string, Tally> {
  const pins = new Map<string, Tally>();
  for (const row of rows) {
    if (!isLabelled(row.outcome)) continue;
    const tally = pins.get(row.pincode) || { n: 0, rtos: 0 };
    tally.n += 1;
    if (isReturn(row.outcome)) tally.rtos += 1;
    pins.set(row.pincode, tally);
  }
  return pins;
}

export function phoneLedger(rows: Array<{ phone: string; outcome: string | null }>): Map<string, Tally> {
  const phones = new Map<string, Tally>();
  for (const row of rows) {
    if (!isLabelled(row.outcome)) continue;
    const key = phoneKey(row.phone);
    if (key.length < 10) continue;
    const tally = phones.get(key) || { n: 0, rtos: 0 };
    tally.n += 1;
    if (isReturn(row.outcome)) tally.rtos += 1;
    phones.set(key, tally);
  }
  return phones;
}

export function pinSignal(pins: Map<string, Tally>, pincode: string): { sellerPinN: number; sellerPinRtoRate: number } {
  const tally = pins.get(pincode);
  const sellerPinN = tally?.n ?? 0;
  const sellerPinRtoRate = sellerPinN >= 6 && tally ? tally.rtos / sellerPinN : 0.3;
  return { sellerPinN, sellerPinRtoRate };
}

export function buyerSignal(
  phones: Map<string, Tally>,
  phone: string,
  priorOrders: number,
  priorRtos: number,
): { priorOrders: number; priorRtos: number } {
  const tally = phones.get(phoneKey(phone));
  if (!tally || tally.n === 0) return { priorOrders, priorRtos: Math.min(priorRtos, priorOrders) };
  const orders = Math.max(priorOrders, tally.n);
  return { priorOrders: orders, priorRtos: Math.min(orders, Math.max(priorRtos, tally.rtos)) };
}
