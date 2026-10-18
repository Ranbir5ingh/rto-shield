export const PROTECTED_CUSTOMER_DATA =
  "Shopify hasn't approved customer-data access for this app yet";

export const SHOPIFY_IMPORT_FAILED = 'Shopify could not finish the import.';

/** Topics registered with webhookSubscriptionCreate. Compliance topics stay in shopify.app.toml. */
export const SHOPIFY_API_WEBHOOK_TOPICS = [
  'ORDERS_CREATE',
  'ORDERS_UPDATED',
  'ORDERS_CANCELLED',
  'ORDERS_PAID',
  'FULFILLMENTS_CREATE',
  'FULFILLMENTS_UPDATE',
  'REFUNDS_CREATE',
  'APP_UNINSTALLED',
] as const;

export const SHOPIFY_CONFIG_ONLY_TOPICS = ['CUSTOMERS_DATA_REQUEST', 'CUSTOMERS_REDACT', 'SHOP_REDACT'] as const;

export class ShopifyQueryError extends Error {
  readonly seller: string;
  readonly logLine: string;

  constructor(seller: string, logLine: string) {
    super(seller);
    this.name = 'ShopifyQueryError';
    this.seller = seller;
    this.logLine = logLine;
  }
}

export interface ShopifyUserError {
  field?: string[] | string | null;
  message?: string | null;
  code?: string | null;
}

export function sanitizeShopifyText(value: string): string {
  return value
    .replace(/shp(?:at|ss|ca|pa)_[A-Za-z0-9_]+/gi, '[token]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [token]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b\d{8,}\b/g, '[number]')
    .replace(/\b[a-f0-9]{32,}\b/gi, '[hex]')
    .replace(/\s+/g, ' ')
    .trim();
}

export function webhookAlreadyRegistered(message: string): boolean {
  return /already been taken|already exists/i.test(message);
}

export function topicsToRegister(existing: readonly string[] | null, topics: readonly string[] = SHOPIFY_API_WEBHOOK_TOPICS): string[] {
  if (!existing) return [...topics];
  const have = new Set(existing);
  return topics.filter((topic) => !have.has(topic));
}

export function hasGraphqlErrors(errors: unknown): boolean {
  if (!errors) return false;
  if (typeof errors === 'string') return errors.trim().length > 0;
  if (Array.isArray(errors)) return errors.length > 0;
  return typeof errors === 'object';
}

export function explainShopify(input: { status?: number; errors?: unknown; userErrors?: ShopifyUserError[] | null }): {
  seller: string;
  log: string;
} {
  const parts: string[] = [];
  if (input.status && input.status >= 400) parts.push(`HTTP ${input.status}`);
  const messages = collectMessages(input.errors, input.userErrors);
  for (const item of messages) {
    if (item.code) parts.push(item.code);
    if (item.field) parts.push(item.field);
    if (item.message) parts.push(item.message);
  }
  const raw = parts.join(' | ');
  const log = (sanitizeShopifyText(raw) || 'Shopify rejected the query').slice(0, 400);
  const seller = sellerReason(input.status, raw, messages).slice(0, 180);
  return { seller, log };
}

export function shopifyFailure(error: unknown): { seller: string; log: string } {
  if (error instanceof ShopifyQueryError) return { seller: error.seller, log: error.logLine };
  const message = error instanceof Error ? error.message : 'Shopify did not answer';
  return explainShopify({ errors: message });
}

/** Seller-facing exception text when orderUpdate or the address tag is rejected. */
export function shopifyWriteException(error: unknown): string {
  const reason = shopifyFailure(error).seller.replace(/\s+/g, ' ').trim() || 'Shopify rejected the write';
  const text = /^shopify write failed\b/i.test(reason) ? reason : `Shopify write failed: ${reason}`;
  return text.slice(0, 240);
}

export function graphqlUserErrors(data: unknown): ShopifyUserError[] {
  const found: ShopifyUserError[] = [];
  const seen = new Set<unknown>();
  const visit = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 6 || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    const record = node as Record<string, unknown>;
    if (Array.isArray(record.userErrors)) {
      for (const item of record.userErrors) {
        if (item && typeof item === 'object') found.push(item as ShopifyUserError);
      }
    }
    for (const [key, value] of Object.entries(record)) {
      if (key === 'userErrors') continue;
      if (value && typeof value === 'object') visit(value, depth + 1);
    }
  };
  visit(data, 0);
  return found;
}

function userErrorMatters(item: ShopifyUserError): boolean {
  const message = (item.message || '').trim();
  if (message && webhookAlreadyRegistered(message)) return false;
  if (message) return true;
  if (item.code) return true;
  if (Array.isArray(item.field)) return item.field.some((part) => Boolean(part));
  return Boolean(item.field);
}

/** userErrors that should fail the mutation. An already-registered webhook is not one of them. */
export function blockingUserErrors(data: unknown): ShopifyUserError[] {
  return graphqlUserErrors(data).filter(userErrorMatters);
}

function collectMessages(errors: unknown, userErrors?: ShopifyUserError[] | null): Array<{ code: string; field: string; message: string }> {
  const rows: Array<{ code: string; field: string; message: string }> = [];
  if (typeof errors === 'string') rows.push({ code: '', field: '', message: errors });
  else if (Array.isArray(errors)) {
    for (const entry of errors) {
      if (typeof entry === 'string') rows.push({ code: '', field: '', message: entry });
      else if (entry && typeof entry === 'object') {
        const record = entry as { message?: unknown; extensions?: { code?: unknown } };
        rows.push({
          code: typeof record.extensions?.code === 'string' ? record.extensions.code : '',
          field: '',
          message: typeof record.message === 'string' ? record.message : '',
        });
      }
    }
  } else if (errors && typeof errors === 'object' && 'message' in errors) {
    const message = (errors as { message?: unknown }).message;
    rows.push({ code: '', field: '', message: typeof message === 'string' ? message : '' });
  }
  for (const item of userErrors || []) {
    const field = Array.isArray(item.field) ? item.field.filter(Boolean).join('.') : item.field || '';
    rows.push({
      code: item.code || '',
      field,
      message: item.message || '',
    });
  }
  return rows;
}

function sellerReason(
  status: number | undefined,
  raw: string,
  messages: Array<{ code: string; field: string; message: string }>,
): string {
  if (isProtectedCustomerData(raw)) return PROTECTED_CUSTOMER_DATA;
  const text = raw.toLowerCase();
  if (status === 401 || status === 403 || /invalid api key or access token|unrecognized login or wrong password/.test(text)) {
    return 'Reconnect Shopify. The shop token was rejected.';
  }
  if (/\bthrottled\b/.test(text)) return 'Shopify is busy. Try the import again in a minute.';
  if (/\b(aborted|timeout|timed out)\b/.test(text)) return 'Shopify did not answer in time. Try the import again.';
  const first = messages.map((item) => item.message.trim()).find(Boolean);
  if (!first) return SHOPIFY_IMPORT_FAILED;
  const compact = first.replace(/\s+/g, ' ').trim();
  const scrubbed = sanitizeShopifyText(compact);
  if (!scrubbed || scrubbed !== compact) return SHOPIFY_IMPORT_FAILED;
  if (/^shopify (rejected the query|request failed)$/i.test(scrubbed)) return SHOPIFY_IMPORT_FAILED;
  return scrubbed;
}

function isProtectedCustomerData(raw: string): boolean {
  const text = raw.toLowerCase();
  if (/protected customer data/.test(text)) return true;
  if (/not approved to access/.test(text) && /customer/.test(text)) return true;
  if (/customer object/.test(text)) return true;
  return /access_denied/.test(text) && /(phone|email|address|shippingaddress|displayname)/.test(text);
}
