/** First address the web proxy actually saw. Vercel puts the browser in front of X-Forwarded-For. */
export function observedClientIp(forwarded: string | null, realIp: string | null): string {
  const first = String(forwarded || '').split(',')[0]?.trim() || '';
  return first || String(realIp || '').trim();
}
