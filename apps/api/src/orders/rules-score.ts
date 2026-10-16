import type { SampleOrder } from '../common/sample';
import type { AddressQuality, PredictResponse, Prediction } from '../ml/ml.types';

export interface PreparedSampleOrder extends SampleOrder {
  hour: number;
}

const JUNK = ['asdf', 'qwerty', 'test', 'xxx', 'fake', 'none', 'n/a', 'na', 'abc123', 'null'];
const LANDMARK = ['near ', 'opp ', 'opp.', 'opposite', 'behind', 'ke paas', 'ke pass', 'ke samne', 'samne', 'nearby'];
const KNOWN_CITIES: Record<string, string> = {
  mumbai: 'maharashtra',
  delhi: 'delhi',
  'new delhi': 'delhi',
  bengaluru: 'karnataka',
  bangalore: 'karnataka',
  jaipur: 'rajasthan',
  lucknow: 'uttar pradesh',
  kolkata: 'west bengal',
  hyderabad: 'telangana',
  ahmedabad: 'gujarat',
  patna: 'bihar',
  indore: 'madhya pradesh',
  pune: 'maharashtra',
  chennai: 'tamil nadu',
  surat: 'gujarat',
};

export const RULES_MODEL = 'rules-prior';
export const RULES_LABEL =
  'Local rules score for this demo open. It uses cash on delivery, buyer history, and address checks. Press Score to run the full model.';

/** How long demo opening waits for the fast model before scoring locally. */
export const DEMO_FAST_TIMEOUT_MS = 1_500;
/** Recent labelled rows are enough for a demo fit. */
export const DEMO_FAST_HISTORY = 90;
/**
 * The shop still shows a full week-by-week history. 180 rows write in about
 * half the time of the 360-row training sample, which keeps demo open under
 * the budget on the free-tier database.
 */
export const DEMO_HISTORY_ROWS = 180;
export const DEMO_PENDING_ROWS = 24;

function heuristicAddress(address: string, pincode: string, city: string, state: string): AddressQuality {
  const text = (address || '').trim();
  const low = text.toLowerCase().replace(/\s+/g, ' ');
  const hasNumber = /\d/.test(text);
  const junk =
    text.length < 4 ||
    /^\d+$/.test(text) ||
    JUNK.some((token) => low.includes(token)) ||
    new Set(low.replace(/ /g, '')).size <= 2;
  const landmarkOnly = !hasNumber && LANDMARK.some((word) => low.includes(word));
  const wordCount = low.split(' ').filter(Boolean).length;
  let incomplete = !junk && (text.length < 18 || (!hasNumber && wordCount < 4 && !landmarkOnly));
  const pins = text.match(/\b[1-9][0-9]{5}\b/g) || [];
  let mismatch = pins.some((pin) => pin !== (pincode || ''));
  const cityL = (city || '').trim().toLowerCase();
  const stateL = (state || '').trim().toLowerCase();
  for (const [known, knownState] of Object.entries(KNOWN_CITIES)) {
    if (known && low.includes(known) && cityL && !cityL.includes(known) && !known.includes(cityL)) mismatch = true;
    if (known === cityL && stateL && !stateL.includes(knownState) && !knownState.includes(stateL) && stateL.length > 1) {
      mismatch = true;
    }
  }
  let quality = 1;
  if (junk) quality -= 0.75;
  if (incomplete) quality -= 0.35;
  if (landmarkOnly) quality -= 0.3;
  if (mismatch) quality -= 0.25;
  if (!text) {
    quality = 0.05;
    incomplete = true;
  }
  quality = Math.max(0, Math.min(1, quality));
  const notes = [
    junk ? 'junk' : '',
    incomplete ? 'incomplete' : '',
    landmarkOnly ? 'landmark' : '',
    mismatch ? 'mismatch' : '',
  ].filter(Boolean);
  return {
    quality_score: Math.round(quality * 1000) / 1000,
    incomplete: Boolean(incomplete || junk),
    landmark_only: landmarkOnly,
    junk,
    pincode_mismatch: mismatch,
    notes: notes.join(', ') || 'ok',
    source: 'heuristic',
  };
}

interface Features {
  is_cod: number;
  high_value_cod: number;
  is_new_buyer: number;
  prior_rto_rate: number;
  prior_orders: number;
  addr_incomplete: number;
  addr_landmark: number;
  addr_junk: number;
  addr_mismatch: number;
  addr_quality: number;
  late_night: number;
  order_value: number;
}

function featuresOf(order: PreparedSampleOrder, quality: AddressQuality): Features {
  const value = order.orderValue || 0;
  const isCod = order.paymentType === 'cod' ? 1 : 0;
  const hour = order.hour % 24;
  const priorOrders = Math.max(0, order.priorOrders || 0);
  const priorRtos = Math.max(0, Math.min(order.priorRtos || 0, priorOrders));
  const rate = priorOrders ? Math.min(1, priorRtos / priorOrders) : 0;
  return {
    is_cod: isCod,
    high_value_cod: isCod && value >= 1500 ? 1 : 0,
    is_new_buyer: priorOrders === 0 ? 1 : 0,
    prior_rto_rate: rate,
    prior_orders: priorOrders,
    addr_incomplete: quality.incomplete ? 1 : 0,
    addr_landmark: quality.landmark_only ? 1 : 0,
    addr_junk: quality.junk ? 1 : 0,
    addr_mismatch: quality.pincode_mismatch ? 1 : 0,
    addr_quality: quality.quality_score,
    late_night: hour >= 22 || hour <= 5 ? 1 : 0,
    order_value: value,
  };
}

function priorLogit(row: Features): number {
  let z = -1.55;
  z += 1.45 * row.is_cod;
  z += 0.95 * row.high_value_cod;
  z += 0.85 * row.is_new_buyer * row.is_cod;
  z += 1.15 * row.prior_rto_rate * (row.prior_orders === 0 ? 0 : 1);
  z += 0.85 * row.addr_incomplete;
  z += 0.75 * row.addr_landmark;
  z += 1.25 * row.addr_junk;
  z += 0.55 * row.addr_mismatch;
  z += 0.35 * row.late_night;
  z -= 1.1 * (1 - row.is_cod);
  if (row.prior_orders >= 3 && row.prior_rto_rate < 0.15 && row.addr_quality >= 0.7) z -= 0.45;
  return z;
}

function probabilityFromLogit(z: number): number {
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const ez = Math.exp(z);
  return ez / (1 + ez);
}

function bandFor(score: number): Prediction['band'] {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

function reasonsFor(row: Features, score: number): string[] {
  const found: string[] = [];
  const value = Math.round(row.order_value);
  if (row.is_cod && row.is_new_buyer) found.push('Cash on delivery from a first-time buyer');
  else if (row.high_value_cod) found.push(`High-value cash-on-delivery order (₹${value})`);
  else if (row.is_cod) found.push('Cash on delivery, which comes back more often than prepaid');
  if (row.prior_orders >= 1 && row.prior_rto_rate >= 0.34) {
    const pct = Math.round(row.prior_rto_rate * 100);
    found.push(`This buyer refused ${pct}% of ${row.prior_orders} earlier orders`);
  }
  if (row.addr_junk) found.push('Address looks junk or too short to deliver');
  else if (row.addr_landmark) found.push('Address is only a landmark, with no house or street number');
  else if (row.addr_incomplete) found.push('Address looks incomplete');
  if (row.addr_mismatch) found.push('The address text and pincode disagree');
  if (row.late_night && row.is_cod) found.push('Placed late at night, when buyers confirm less often');

  if (score < 40) {
    const calm: string[] = [];
    if (!row.is_cod) calm.push('Prepaid order — the buyer has already paid');
    if (row.prior_orders >= 2 && row.prior_rto_rate < 0.2) calm.push('Repeat buyer with a clean delivery history');
    if (row.addr_quality >= 0.75 && !row.addr_incomplete) calm.push('Address looks complete enough to ship');
    if (calm.length) return calm.slice(0, 3);
  }
  if (!found.length) found.push('Mixed signals from payment type, order value, and buyer history');
  return found.slice(0, 3);
}

function scoreOne(order: PreparedSampleOrder): Prediction {
  const quality = heuristicAddress(order.address, order.pincode, order.city, order.state);
  const row = featuresOf(order, quality);
  const probability = Math.max(0, Math.min(1, probabilityFromLogit(priorLogit(row))));
  const score = Math.round(probability * 100);
  return {
    id: order.externalOrderId,
    score,
    probability: Math.round(probability * 10000) / 10000,
    band: bandFor(score),
    reasons: reasonsFor(row, score),
    address_quality: quality,
    model: RULES_MODEL,
  };
}

export function scoreWithRules(orders: PreparedSampleOrder[]): PredictResponse {
  const predictions = orders.filter((order) => order.stage === 'pending').map(scoreOne);
  return {
    model: RULES_MODEL,
    model_label: RULES_LABEL,
    metrics: null,
    predictions,
    warnings: ['Scored with local rules because the scoring service did not answer in time.'],
    address_source: 'heuristic',
    feature_columns: [],
  };
}
