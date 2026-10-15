export const WAKE_TIMEOUT_MS = 180_000;
export const WAKE_GRACE_MS = 400;
/** Each ping gives up quickly so a hung cold start does not stall the next try. */
export const WAKE_PING_MS = 4_000;

export const WAKE_MESSAGES = [
  "Waking up RTO Shield's servers (free hosting naps when idle)...",
  'Warming up the risk model...',
  'Almost there, usually under a minute',
] as const;

export type WakeSnapshot = { api: boolean; ml: boolean };
export type WakePhase = 'checking' | 'ready' | 'failed';

export type WakeMachine = {
  phase: WakePhase;
  snap: WakeSnapshot;
  attempt: number;
  elapsedMs: number;
};

export function initialWake(): WakeMachine {
  return { phase: 'checking', snap: { api: false, ml: false }, attempt: 0, elapsedMs: 0 };
}

/**
 * One step of the loader. Ready only when both backends are up.
 * A late success still counts. Otherwise the timeout ends the wait.
 */
export function stepWake(
  machine: WakeMachine,
  probe: WakeSnapshot,
  elapsedMs: number,
): { machine: WakeMachine; waitMs: number } {
  if (probe.api && probe.ml) {
    return {
      machine: { phase: 'ready', snap: probe, attempt: machine.attempt, elapsedMs },
      waitMs: 0,
    };
  }
  if (elapsedMs > WAKE_TIMEOUT_MS) {
    return {
      machine: { phase: 'failed', snap: probe, attempt: machine.attempt, elapsedMs },
      waitMs: 0,
    };
  }
  return {
    machine: { phase: 'checking', snap: probe, attempt: machine.attempt + 1, elapsedMs },
    waitMs: wakeDelayMs(machine.attempt),
  };
}

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
  if (snap.api || snap.ml) return Math.min(0.9, 0.55 + elapsedMs / 160_000);
  return Math.min(0.45, 0.18 + elapsedMs / 140_000);
}

export function mlHealthUrl(): string {
  return (process.env.NEXT_PUBLIC_ML_HEALTH_URL || '').trim();
}

/** 2xx with `{ ok: true }`. Render cold-start 502/503/504 and anything else stay down. */
export function responseIsUp(status: number, body: { ok?: boolean } | null): boolean {
  if (status < 200 || status >= 300) return false;
  return body?.ok === true;
}

async function ping(fetchImpl: typeof fetch, url: string): Promise<boolean> {
  try {
    const response = await fetchImpl(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(WAKE_PING_MS),
    });
    const body = (await response.json().catch(() => null)) as { ok?: boolean } | null;
    return responseIsUp(response.status, body);
  } catch {
    return false;
  }
}

/**
 * Ping the API and the ML service together.
 * ML is up when the same-origin pass-through answers, or when the optional public health URL does.
 */
export async function probeWake(fetchImpl: typeof fetch = fetch): Promise<WakeSnapshot> {
  const direct = mlHealthUrl();
  const [api, viaApi, viaDirect] = await Promise.all([
    ping(fetchImpl, '/api/health'),
    ping(fetchImpl, '/api/health/ml'),
    direct ? ping(fetchImpl, direct) : Promise.resolve(false),
  ]);
  return { api, ml: viaApi || viaDirect };
}

/** Inline script for the first paint. Fires before React so a cold start begins on landing. */
export function landingWakeScript(directUrl = mlHealthUrl()): string {
  const calls = [
    "fetch('/api/health',{cache:'no-store'}).catch(function(){})",
    "fetch('/api/health/ml',{cache:'no-store'}).catch(function(){})",
  ];
  const url = directUrl.trim();
  if (url) {
    calls.push(`fetch(${JSON.stringify(url)},{cache:'no-store',mode:'cors'}).catch(function(){})`);
  }
  return calls.join(';');
}
