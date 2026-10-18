export const ORDER_CONFIRMATION_EN =
  'Hi {{1}}, please confirm your cash on delivery order {{2}} for Rs {{3}} by tapping a button below.';

export const TEMPLATE_REJECTED = 'WhatsApp rejected the template.';

export interface TemplateIdentity {
  name: string;
  language: 'en' | 'hi';
}

export interface ListedTemplate {
  name?: string;
  language?: string;
  status?: string;
}

export type TemplateFlow =
  | 'order_confirmation'
  | 'address_update_request'
  | 'payment_link_request'
  | 'prepaid_offer'
  | 'order_reminder'
  | 'address_updated_confirmation';

export const CONFIRMATION_LANGUAGES = ['english', 'hindi', 'hinglish'] as const;

export const TEMPLATE_FLOWS: TemplateFlow[] = [
  'order_confirmation',
  'address_update_request',
  'payment_link_request',
  'prepaid_offer',
  'order_reminder',
  'address_updated_confirmation',
];

/** Utility template first. prepaid_offer is the marketing copy, used only if Utility is not approved. */
export const PREPAID_FLOWS: TemplateFlow[] = ['payment_link_request', 'prepaid_offer'];

export function expectedTemplate(messageLanguage: string, flow: TemplateFlow = 'order_confirmation'): TemplateIdentity {
  if (flow === 'order_confirmation') {
    if (messageLanguage === 'hindi') return { name: 'order_confirmation', language: 'hi' };
    if (messageLanguage === 'hinglish') return { name: 'order_confirmation_hinglish', language: 'en' };
    return { name: 'order_confirmation', language: 'en' };
  }
  if (messageLanguage === 'hindi') return { name: flow, language: 'hi' };
  if (messageLanguage === 'hinglish') return { name: `${flow}_hinglish`, language: 'en' };
  return { name: flow, language: 'en' };
}

export function templateKey(identity: TemplateIdentity) {
  return `${identity.name}:${identity.language}`;
}

/** payment_link_request, then prepaid_offer, then order_confirmation. Other flows fall back once. */
export function chooseApprovedFlow(
  requested: TemplateFlow,
  approved: (flow: TemplateFlow) => boolean,
): { flow: TemplateFlow; fallback: boolean } | null {
  const prepaid = requested === 'payment_link_request' || requested === 'prepaid_offer';
  const chain: TemplateFlow[] = prepaid
    ? [...PREPAID_FLOWS, 'order_confirmation']
    : requested === 'order_confirmation'
      ? ['order_confirmation']
      : [requested, 'order_confirmation'];
  for (const flow of chain) {
    if (!approved(flow)) continue;
    return { flow, fallback: flow === 'order_confirmation' && requested !== 'order_confirmation' };
  }
  return null;
}

/** Meta rejects empty text, newlines, and runs of spaces. */
export function templateText(value: string | number | null | undefined, fallback: string) {
  const clean = String(value ?? '').replace(/[\n\r\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, 200);
  return clean || fallback;
}

export interface FlowFields {
  firstName: string;
  orderNo: string;
  amount: string;
  store: string;
  address: string;
  discount: string;
  payToken: string;
}

export function flowBodyParameters(flow: TemplateFlow, fields: FlowFields) {
  const name = templateText(fields.firstName, 'there');
  const order = templateText(fields.orderNo, 'order');
  const amount = templateText(fields.amount, '0');
  const store = templateText(fields.store, 'the shop');
  const address = templateText(fields.address, 'the address on file');
  const discount = templateText(fields.discount, '0');
  const values = flow === 'address_update_request'
    ? [name, order, amount, store, address]
    : flow === 'prepaid_offer'
      ? [name, order, amount, discount]
      : flow === 'payment_link_request'
        ? [name, order, amount]
        : flow === 'order_reminder'
          ? [name, order, store]
          : flow === 'address_updated_confirmation'
            ? [name, order, address]
            : [name, order, amount];
  return values.map((text) => ({ type: 'text' as const, text }));
}

export function flowComponents(flow: TemplateFlow, fields: FlowFields) {
  const components: Array<Record<string, unknown>> = [{ type: 'body', parameters: flowBodyParameters(flow, fields) }];
  if (flow === 'payment_link_request' || flow === 'prepaid_offer') {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: templateText(fields.payToken, 'demo') }],
    });
  }
  return components;
}

export type ButtonChoice = 'address_ok' | 'keep_cod' | 'confirmed' | 'cancelled' | '';

export function readButtonChoice(text: string): ButtonChoice {
  const value = text.toLowerCase();
  if (value.includes('address is correct') || value.includes('address_correct')) return 'address_ok';
  if (value.includes('keep cod')) return 'keep_cod';
  if (value.includes('cancel')) return 'cancelled';
  if (value.includes('confirm')) return 'confirmed';
  return '';
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function sessionOpen(conversation: Array<{ at?: string; direction?: string }> | null | undefined, now = Date.now()) {
  const inbound = (conversation || []).filter((item) => item.direction === 'in' && item.at);
  const last = inbound[inbound.length - 1];
  if (!last?.at) return false;
  const at = Date.parse(last.at);
  return Number.isFinite(at) && now - at < DAY_MS && now >= at;
}

export function pickTemplateStatus(rows: ListedTemplate[], expected: TemplateIdentity): string {
  const match = rows.find((row) => row.name === expected.name && row.language === expected.language);
  return match?.status || '';
}

export function explainMetaTemplateError(status: number, body: unknown): { seller: string; log: string } {
  const error = readMetaError(body);
  const raw = [error.userMsg, error.message].map((part) => part.trim()).find(Boolean) || '';
  const compact = raw.replace(/\s+/g, ' ').trim();
  const scrubbed = sanitizeMetaText(compact);
  const seller = !scrubbed || scrubbed !== compact ? TEMPLATE_REJECTED : scrubbed.slice(0, 180);
  const log = sanitizeMetaText(
    [`HTTP ${status}`, error.code, error.subcode, error.userMsg, error.message].filter(Boolean).join(' | '),
  ).slice(0, 400);
  return { seller: seller || TEMPLATE_REJECTED, log: log || `HTTP ${status}` };
}

function readMetaError(body: unknown): { userMsg: string; message: string; code: string; subcode: string } {
  const empty = { userMsg: '', message: '', code: '', subcode: '' };
  if (!body || typeof body !== 'object') return empty;
  const error = (body as { error?: unknown }).error;
  if (typeof error === 'string') return { ...empty, message: error };
  if (!error || typeof error !== 'object') return empty;
  const row = error as { message?: unknown; error_user_msg?: unknown; code?: unknown; error_subcode?: unknown };
  return {
    userMsg: typeof row.error_user_msg === 'string' ? row.error_user_msg : '',
    message: typeof row.message === 'string' ? row.message : '',
    code: row.code === undefined || row.code === null ? '' : String(row.code),
    subcode: row.error_subcode === undefined || row.error_subcode === null ? '' : String(row.error_subcode),
  };
}

function sanitizeMetaText(value: string): string {
  return value
    .replace(/\bEAA[A-Za-z0-9]+/g, '[token]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [token]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b\d{8,}\b/g, '[number]')
    .replace(/\s+/g, ' ')
    .trim();
}
