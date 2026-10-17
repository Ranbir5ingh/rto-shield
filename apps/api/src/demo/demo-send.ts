import { whatsappNumber } from '../common/phone';

/** Digits from DEMO_WHATSAPP_ALLOWLIST, stored as 91XXXXXXXXXX when that is a valid Indian mobile. */
export function whatsappAllowlist(raw: string | undefined): string[] {
  const seen = new Set<string>();
  for (const part of (raw || '').split(/[\s,]+/)) {
    const number = whatsappNumber(part);
    if (number) seen.add(number);
  }
  return [...seen];
}
