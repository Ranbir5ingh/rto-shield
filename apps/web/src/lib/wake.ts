export const WAKE_TIMEOUT_MS = 180_000;
export const WAKE_GRACE_MS = 400;

export const WAKE_MESSAGES = [
  "Waking up RTO Shield's servers (free hosting naps when idle)...",
  'Warming up the risk model...',
  'Almost there, usually under a minute',
] as const;

export type WakeSnapshot = { api: boolean; ml: boolean };

export function routeNeedsApi(pathname: string): boolean {
  return pathname === '/login' || pathname.startsWith('/login/') || pathname === '/signup' || pathname.startsWith('/signup/') || pathname === '/app' || pathname.startsWith('/app/');
}

export function wakeDelayMs(attempt: number): number {
  const steps = [3_000, 4_000, 5_000];
  return steps[Math.min(Math.max(attempt, 0), steps.length - 1)];
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function wakeMessage(elapsedMs: number, apiUp: boolean): string {
  if (elapsedMs >= 70_000) {
    return 'Still waking. Free servers sometimes need a bit over a minute.';
  }
  if (apiUp) return WAKE_MESSAGES[1];
  const index = Math.floor(elapsedMs / 4_500) % WAKE_MESSAGES.length;
  return WAKE_MESSAGES[index];
}

export function wakeProgress(elapsedMs: number, snap: WakeSnapshot): number {
  if (snap.api && snap.ml) return 1;
  if (snap.api) return Math.min(0.9, 0.55 + elapsedMs / 160_000);
  return Math.min(0.45, 0.18 + elapsedMs / 140_000);
}

const HEALTH_MS = 65_000;
const DEEP_MS = 20_000;

async function readOk(response: Response): Promise<boolean> {
  if (!response.ok) return false;
  const body = (await response.json().catch(() => null)) as { ok?: boolean } | null;
  return Boolean(body?.ok);
}

export async function probeWake(fetchImpl: typeof fetch = fetch): Promise<WakeSnapshot> {
  let api = false;
  try {
    api = await readOk(
      await fetchImpl('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(HEALTH_MS) }),
    );
  } catch {
    api = false;
  }
  if (!api) return { api: false, ml: false };
  try {
    const response = await fetchImpl('/api/health/deep', {
      cache: 'no-store',
      signal: AbortSignal.timeout(DEEP_MS),
    });
    if (!response.ok) return { api: true, ml: false };
    const body = (await response.json().catch(() => null)) as { ml?: { ok?: boolean } } | null;
    return { api: true, ml: Boolean(body?.ml?.ok) };
  } catch {
    return { api: true, ml: false };
  }
}
