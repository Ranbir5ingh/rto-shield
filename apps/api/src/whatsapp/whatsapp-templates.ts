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

export function expectedTemplate(messageLanguage: string): TemplateIdentity {
  if (messageLanguage === 'hindi') return { name: 'order_confirmation', language: 'hi' };
  if (messageLanguage === 'hinglish') return { name: 'order_confirmation_hinglish', language: 'en' };
  return { name: 'order_confirmation', language: 'en' };
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
