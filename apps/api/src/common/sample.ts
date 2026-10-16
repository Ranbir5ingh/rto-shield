export interface SampleOrder {
  externalOrderId: string;
  buyerName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  orderValue: number;
  paymentType: 'cod' | 'prepaid';
  orderedAt: Date;
  priorOrders: number;
  priorRtos: number;
  productName: string;
  courier: string;
  stage: 'history' | 'pending';
  outcome: 'delivered' | 'rto' | null;
}

const FIRST = ['Aarav', 'Ananya', 'Rohan', 'Priya', 'Mohammed', 'Fatima', 'Sneha', 'Vikram', 'Pooja', 'Amit', 'Kavya', 'Rahul', 'Neha', 'Arjun', 'Divya', 'Imran', 'Kiran', 'Meera', 'Sanjay', 'Lakshmi'];
const LAST = ['Sharma', 'Verma', 'Patel', 'Reddy', 'Iyer', 'Khan', 'Singh', 'Gupta', 'Nair', 'Das', 'Joshi', 'Chowdhury', 'Bose', 'Yadav', 'Kulkarni'];
const PLACES: Array<[string, string, string[]]> = [
  ['Mumbai', 'Maharashtra', ['400001', '400014', '400058', '400092']],
  ['Delhi', 'Delhi', ['110001', '110059', '110085', '110092']],
  ['Bengaluru', 'Karnataka', ['560001', '560038', '560076', '560100']],
  ['Jaipur', 'Rajasthan', ['302001', '302012', '302017', '302021']],
  ['Lucknow', 'Uttar Pradesh', ['226001', '226010', '226016', '226024']],
  ['Kolkata', 'West Bengal', ['700001', '700019', '700091', '700156']],
  ['Hyderabad', 'Telangana', ['500001', '500028', '500081', '500090']],
  ['Ahmedabad', 'Gujarat', ['380001', '380015', '380054', '380061']],
  ['Patna', 'Bihar', ['800001', '800014', '800020', '800025']],
  ['Indore', 'Madhya Pradesh', ['452001', '452010', '452016', '453331']],
];
const PRODUCTS = ['Cotton kurti', 'Daily saree', 'Mobile cover', 'Oxidised earrings', 'Steel tiffin', 'Kids frock'];
const LANDMARKS = ['Hanuman mandir', 'SBI ATM', 'purana bus stand', 'paani ki tanki', 'red gate'];
const STREETS = ['Gali no 4', 'Lane 2, Shastri Nagar', 'Main Market', 'Sector 7', 'Teachers Colony'];
const COURIERS = ['Delhivery', 'Shadowfax', 'Xpressbees', 'Ecom Express'];
// Repeat buyers with one earlier refusal. The trained demo model scores a
// first late-night order as Low and a junk order as High, so Medium has to
// look like this or the shop shows only two bands.
const MEDIUM_PROFILES: Array<{ priorOrders: number; priorRtos: number; orderValue: number; hour: number; address: string }> = [
  { priorOrders: 4, priorRtos: 1, orderValue: 1599, hour: 16, address: 'H.No 8, Gali 2' },
  { priorOrders: 4, priorRtos: 1, orderValue: 1899, hour: 21, address: 'Sector 7 market' },
  { priorOrders: 4, priorRtos: 1, orderValue: 1899, hour: 18, address: 'H.No 18, Lane 9' },
  { priorOrders: 5, priorRtos: 1, orderValue: 1899, hour: 16, address: 'H.No 9, Gali 3' },
  { priorOrders: 5, priorRtos: 1, orderValue: 2499, hour: 18, address: 'Sector 4 market' },
  { priorOrders: 4, priorRtos: 1, orderValue: 1599, hour: 18, address: 'H.No 15, Lane 6' },
  { priorOrders: 5, priorRtos: 1, orderValue: 2499, hour: 21, address: 'H.No 7, Gali 6' },
  { priorOrders: 4, priorRtos: 1, orderValue: 1599, hour: 16, address: 'H.No 11, Lane 5' },
];
const HIGH_ADDRESSES = ['asdf', 'test', 'xxx', 'qwerty', 'fake', 'null'];

/** A fixed IST hour, so demo scoring does not depend on when the shop was opened. */
function atKolkataHour(hour: number): Date {
  // 14 Jun 2026 18:30 UTC is 15 Jun 2026 00:00 in Asia/Kolkata.
  return new Date(Date.UTC(2026, 5, 14, 18, 30, 0) + hour * 60 * 60 * 1000);
}

function pendingProfile(slot: number, city: string) {
  if (slot < 10) {
    const cod = slot < 6;
    return {
      address: `H.No ${12 + slot}, Lane 4, Shastri Nagar, ${city}`,
      paymentType: (cod ? 'cod' : 'prepaid') as 'cod' | 'prepaid',
      priorOrders: cod ? 5 : 3,
      priorRtos: 0,
      orderValue: cod ? 499 : 899,
      orderedAt: atKolkataHour(14),
    };
  }
  if (slot < 18) {
    const profile = MEDIUM_PROFILES[slot - 10]!;
    return {
      address: profile.address,
      paymentType: 'cod' as const,
      priorOrders: profile.priorOrders,
      priorRtos: profile.priorRtos,
      orderValue: profile.orderValue,
      orderedAt: atKolkataHour(profile.hour),
    };
  }
  return {
    address: HIGH_ADDRESSES[slot - 18] || 'asdf',
    paymentType: 'cod' as const,
    priorOrders: 2,
    priorRtos: 2,
    orderValue: 2499,
    orderedAt: atKolkataHour(0),
  };
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pinTendency(pincode: string): number {
  const bucket = [...pincode].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5;
  return [0.12, 0.22, 0.28, 0.4, 0.55][bucket] ?? 0.28;
}

function sigmoid(z: number): number {
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const ez = Math.exp(z);
  return ez / (1 + ez);
}

export function generateSample(seed = 42, historyCount = 360, pendingCount = 24): SampleOrder[] {
  const rand = mulberry32(seed);
  const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)]!;
  const total = historyCount + pendingCount;
  // Fixed clock so the trained demo model does not change with the time of day.
  const start = Date.UTC(2026, 5, 1);
  const orders: SampleOrder[] = [];

  for (let i = 0; i < total; i += 1) {
    const [city, state, pins] = PLACES[i % PLACES.length]!;
    const roll = rand();
    let address = '';
    let addrIncomplete = 0;
    let addrLandmark = 0;
    let addrJunk = 0;
    let addrMismatch = 0;
    let addrQuality = 0.9;
    if (roll < 0.62) {
      address = `H.No ${1 + Math.floor(rand() * 240)}, ${pick(STREETS)}, ${city}`;
    } else if (roll < 0.78) {
      address = `near ${pick(LANDMARKS)}`;
      addrIncomplete = 1;
      addrLandmark = 1;
      addrQuality = 0.35;
    } else if (roll < 0.9) {
      address = pick(['asdf', 'test', 'xxx']);
      addrIncomplete = 1;
      addrJunk = 1;
      addrQuality = 0.08;
    } else {
      const other = PLACES[(i + 3) % PLACES.length]!;
      address = `H.No ${1 + Math.floor(rand() * 80)}, ${pick(STREETS)}, ${other[0]}`;
      addrMismatch = 1;
      addrQuality = 0.45;
    }
    const isCod = rand() < 0.78;
    let priorOrders = 0;
    let priorRtos = 0;
    if (rand() >= 0.45) {
      priorOrders = 1 + Math.floor(rand() * 8);
      const base = rand() < 0.18 ? 0.55 : 0.12;
      priorRtos = Array.from({ length: priorOrders }, () => (rand() < base ? 1 : 0)).reduce((sum, n) => sum + n, 0 as number);
    }
    const orderValue = pick([299, 399, 499, 649, 799, 999, 1299, 1599, 1899, 2499, 3499]);
    const hour = pick([11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 0, 1]);
    const stage = i < historyCount ? 'history' : 'pending';
    const planted = stage === 'pending' ? pendingProfile(i - historyCount, city) : null;
    const addressOut = planted?.address ?? address;
    const paymentType = planted?.paymentType ?? (isCod ? 'cod' : 'prepaid');
    const priorOrdersOut = planted?.priorOrders ?? priorOrders;
    const priorRtosOut = planted?.priorRtos ?? priorRtos;
    const orderValueOut = planted?.orderValue ?? orderValue;
    const rate = priorOrders ? priorRtos / priorOrders : 0;
    const pincode = pick(pins);
    const pinRate = pinTendency(pincode);
    let z = -2.2;
    z += 0.4 * (isCod ? 1 : 0);
    z += 0.9 * (isCod && orderValue >= 1500 ? 1 : 0);
    z += 0.5 * (priorOrders === 0 && isCod ? 1 : 0);
    z += 2.0 * rate * (priorOrders ? 1 : 0);
    z += 1.15 * addrJunk;
    z += 0.6 * addrIncomplete;
    z += 0.45 * addrLandmark;
    z += 0.4 * addrMismatch;
    z += 0.5 * ((hour >= 22 || hour <= 5) && isCod ? 1 : 0);
    z += 1.15 * (pinRate - 0.3);
    z -= 0.45 * (isCod ? 0 : 1);
    if (priorOrders >= 2 && rate < 0.15 && addrQuality >= 0.7) z -= 0.95;
    const label = rand() < sigmoid(z);
    const orderedAt = planted
      ? planted.orderedAt
      : new Date(start + rand() * 50 * 24 * 60 * 60 * 1000 + hour * 60 * 60 * 1000);
    orders.push({
      externalOrderId: `S${String(i).padStart(4, '0')}`,
      buyerName: `${pick(FIRST)} ${pick(LAST)}`,
      phone: `9${String(Math.floor(100000000 + rand() * 900000000)).slice(0, 9)}`,
      address: addressOut,
      city,
      state,
      pincode,
      orderValue: orderValueOut,
      paymentType,
      orderedAt,
      priorOrders: priorOrdersOut,
      priorRtos: priorRtosOut,
      productName: pick(PRODUCTS),
      courier: pick(COURIERS),
      stage,
      outcome: stage === 'history' ? (label ? 'rto' : 'delivered') : null,
    });
  }
  return orders;
}
