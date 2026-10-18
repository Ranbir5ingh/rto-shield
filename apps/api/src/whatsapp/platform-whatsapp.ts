export interface PlatformWhatsApp {
  token: string;
  phoneNumberId: string;
  wabaId: string;
  appSecret: string;
}

export interface OwnNumberLink {
  useOwnNumber?: boolean;
  tokenEnvelope?: unknown;
  phoneNumberId?: string;
  wabaId?: string;
}

/** Meta must call the API host. The shop site on www proxies other routes and is not this webhook. */
export function whatsappCallbackUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = (env.WHATSAPP_WEBHOOK_URL || '').trim().replace(/\/$/, '');
  if (!explicit) return 'https://api.rtoshield.tech/api/whatsapp/webhook';
  if (explicit.endsWith('/whatsapp/webhook')) return explicit;
  return `${explicit}/api/whatsapp/webhook`;
}

/** Server env for RTO Shield's WABA. Empty fields mean the platform number is not configured. */
export function platformWhatsApp(env: NodeJS.ProcessEnv = process.env): PlatformWhatsApp | null {
  const token = (env.WHATSAPP_PLATFORM_TOKEN || '').trim();
  const phoneNumberId = (env.WHATSAPP_PLATFORM_PHONE_NUMBER_ID || '').trim();
  const wabaId = (env.WHATSAPP_PLATFORM_WABA_ID || '').trim();
  const appSecret = (env.WHATSAPP_PLATFORM_APP_SECRET || '').trim();
  if (!token || !phoneNumberId || !wabaId || !appSecret) return null;
  return { token, phoneNumberId, wabaId, appSecret };
}

/** Saved creds send and receive on the shop's number. useOwnNumber false keeps the creds and uses the platform number. */
export function usesOwnNumber(link: OwnNumberLink | null | undefined): boolean {
  if (!link?.tokenEnvelope || !link.phoneNumberId || !link.wabaId) return false;
  return link.useOwnNumber !== false;
}
