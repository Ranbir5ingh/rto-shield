export interface Envelope {
  v: 1;
  iv: string;
  tag: string;
  data: string;
  dekIv: string;
  dekTag: string;
  dek: string;
  keyVersion: number;
}

export function deriveKey(raw: string): Buffer;
export function last4(secret: string): string;
export function seal(plain: string, master: string): Envelope;
export function open(envelope: Envelope, master: string): string;
export function safeEqual(left: string, right: string): boolean;
export function shopifyWebhookHmac(raw: Buffer | string, secret: string): string;
export function verifyShopifyWebhook(raw: Buffer | string, header: string | undefined, secret: string): boolean;
export function shopifyOauthHmac(query: Record<string, string | string[]>, secret: string): string;
export function verifyShopifyOauth(query: Record<string, string | string[] | undefined>, secret: string): boolean;
export function metaSignature(raw: Buffer | string, secret: string): string;
export function verifyMetaSignature(raw: Buffer | string, header: string | undefined, secret: string): boolean;
