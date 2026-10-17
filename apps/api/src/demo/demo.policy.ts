import { createHash } from 'crypto';

export type SessionRole = 'owner' | 'staff' | 'demo';

export interface ActorCarrier {
  role?: string;
  $locals?: {
    actor?: 'demo';
    demoTourSeen?: boolean;
    demoSessionId?: string;
  };
}

export function effectiveRole(user: ActorCarrier | null | undefined): SessionRole {
  if (user?.$locals?.actor === 'demo' || user?.role === 'demo') return 'demo';
  if (user?.role === 'staff') return 'staff';
  return 'owner';
}

export function demoAccountEmail(): string {
  return (process.env.DEMO_ACCOUNT_EMAIL || '').trim().toLowerCase();
}

export function isOfficialDemoAccount(email: string | undefined): boolean {
  const expected = demoAccountEmail();
  return Boolean(expected && email && email.trim().toLowerCase() === expected);
}

export function demoSessionMs(): number {
  const parsed = Number(process.env.DEMO_SESSION_MS || 2 * 60 * 60 * 1000);
  if (!Number.isFinite(parsed)) return 2 * 60 * 60 * 1000;
  return Math.min(Math.max(parsed, 5 * 60 * 1000), 12 * 60 * 60 * 1000);
}

export function demoResetMs(): number {
  const hours = Number(process.env.DEMO_RESET_HOURS || 3);
  if (!Number.isFinite(hours) || hours <= 0) return 3 * 60 * 60 * 1000;
  return hours * 60 * 60 * 1000;
}

export function demoSendCap(): number {
  const parsed = Number(process.env.DEMO_WHATSAPP_DAILY_CAP || 25);
  if (!Number.isFinite(parsed) || parsed < 0) return 25;
  return Math.floor(parsed);
}

export function hashDemoIp(ip: string): string {
  return createHash('sha256')
    .update(`rto-demo|${process.env.JWT_SECRET || ''}|${ip}`)
    .digest('hex')
    .slice(0, 16);
}

export function requestPath(url: string): string {
  const bare = (url || '/').split('?')[0].replace(/\/+$/, '') || '/';
  return bare.startsWith('/api/') ? bare.slice(4) : bare;
}

const DEMO_WRITES = [
  /^\/orders\/[^/]+\/outcome$/,
  /^\/orders\/score$/,
  /^\/orders\/[^/]+\/voice$/,
  /^\/orders\/[^/]+\/prepaid$/,
  /^\/orders\/[^/]+\/address$/,
  /^\/orders\/[^/]+\/call$/,
  /^\/orders\/[^/]+\/escalate$/,
  /^\/orders\/preview$/,
  /^\/whatsapp\/send$/,
  /^\/tours\/complete$/,
  /^\/auth\/logout$/,
  /^\/auth\/refresh$/,
];

const DEMO_BLOCKED_READS = [/^\/account\/export$/];

/** Demo visitors can read the shop, decide orders, and rescore. Everything else is refused. */
export function demoAllows(method: string, url: string): boolean {
  const verb = method.toUpperCase();
  const path = requestPath(url);
  if (verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') {
    return !DEMO_BLOCKED_READS.some((pattern) => pattern.test(path));
  }
  return DEMO_WRITES.some((pattern) => pattern.test(path));
}
