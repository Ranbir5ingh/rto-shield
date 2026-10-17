import { createHmac, timingSafeEqual } from 'crypto';

const MAX_SKEW_MS = 30 * 60 * 1000;

export type CallOutcome = 'confirmed' | 'cancelled' | 'address' | 'prepaid' | 'no_response';

export interface ParsedCall {
  conversationId: string;
  orderId: string;
  outcome: CallOutcome;
  landmark: string;
  address: string;
}

export function verifyElevenSignature(raw: Buffer, header: string | undefined, secret: string, nowMs = Date.now()): boolean {
  if (!secret || !header) return false;
  const parts = header.split(',').map((part) => part.trim());
  const stamp = parts.find((part) => part.startsWith('t='))?.slice(2) || '';
  const given = parts.find((part) => part.startsWith('v0='))?.slice(3) || '';
  if (!/^\d+$/.test(stamp) || !/^[a-f0-9]+$/i.test(given)) return false;
  const ts = Number(stamp) * 1000;
  if (!Number.isFinite(ts) || Math.abs(nowMs - ts) > MAX_SKEW_MS) return false;
  const mac = createHmac('sha256', secret).update(`${stamp}.${raw.toString('utf8')}`).digest('hex');
  const left = Buffer.from(mac.toLowerCase());
  const right = Buffer.from(given.toLowerCase());
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function parseCallOutcome(body: unknown): ParsedCall {
  const root = asRecord(body) || {};
  const data = asRecord(root.data) || root;
  const analysis = asRecord(data.analysis);
  const collected = asRecord(analysis?.data_collection_results);
  const evaluation = asRecord(analysis?.evaluation_criteria_results);
  const init = asRecord(data.conversation_initiation_client_data);
  const variables = asRecord(init?.dynamic_variables);
  const outcome = normalizeOutcome(readValue(collected, 'outcome') || readEval(evaluation));
  const landmark = readValue(collected, 'landmark').slice(0, 160);
  const address = (readValue(collected, 'address') || readValue(collected, 'address_line')).slice(0, 300);
  const orderId = String(variables?.rto_order || variables?.order_id || '').trim();
  return {
    conversationId: String(data.conversation_id || root.conversation_id || '').slice(0, 80),
    orderId,
    outcome,
    landmark,
    address,
  };
}

function readValue(bag: Record<string, unknown> | null, key: string): string {
  if (!bag) return '';
  const slot = bag[key];
  if (typeof slot === 'string') return slot.trim();
  const record = asRecord(slot);
  const value = record?.value;
  return typeof value === 'string' ? value.trim() : '';
}

function readEval(bag: Record<string, unknown> | null): string {
  if (!bag) return '';
  for (const key of ['outcome', 'confirmed', 'cancelled', 'prepaid', 'address']) {
    const slot = asRecord(bag[key]);
    const result = String(slot?.result || slot?.value || '').toLowerCase();
    if (result === 'success' && key !== 'outcome') return key;
    if (result && key === 'outcome') return result;
  }
  return '';
}

function normalizeOutcome(value: string): CallOutcome {
  const text = value.toLowerCase().trim();
  if (text === 'confirmed' || text === 'confirm') return 'confirmed';
  if (text === 'cancelled' || text === 'cancel') return 'cancelled';
  if (text === 'prepaid' || text === 'pay') return 'prepaid';
  if (text === 'address' || text === 'landmark') return 'address';
  if (text === 'no_response' || text === 'no response' || !text) return 'no_response';
  if (text.includes('cancel')) return 'cancelled';
  if (text.includes('prepaid')) return 'prepaid';
  if (text.includes('address') || text.includes('landmark')) return 'address';
  if (text.includes('confirm')) return 'confirmed';
  return 'no_response';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
