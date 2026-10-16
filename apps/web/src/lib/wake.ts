export const WAKE_TIMEOUT_MS = 180_000;
export const WAKE_GRACE_MS = 400;
/**
 * Readiness checks stay short so the loader can poll.
 * The wake itself is a separate browser request held open much longer:
 * Render's free tier only spins up when a request actually stays connected,
 * and the Vercel proxy used to abort that connection after 3.5s.
 */
export const WAKE_PING_MS = 8_000;
/** How long a direct browser request stays open, long enough for a free-tier cold start. */
export const WAKE_HOLD_MS = 75_000;

export const PRODUCTION_API_HEALTH = 'https://api.rtoshield.tech/api/health';
export const PRODUCTION_ML_HEALTH = 'https://ml.rtoshield.tech/health';
/** Same free instances, reached without the custom domain. Opening these in a tab is what used to wake them by hand. */
export const ONRENDER_API_HEALTH = 'https://rto-shield-api.onrender.com/api/health';
export const ONRENDER_ML_HEALTH = 'https://rto-shield-ml.onrender.com/health';

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

export function productionHealthUrls(): { api: string; ml: string } {
  const api = (process.env.NEXT_PUBLIC_API_HEALTH_URL || PRODUCTION_API_HEALTH).trim();
  const ml = (process.env.NEXT_PUBLIC_ML_HEALTH_URL || PRODUCTION_ML_HEALTH).trim();
  return {
    api: api || PRODUCTION_API_HEALTH,
    ml: ml || PRODUCTION_ML_HEALTH,
  };
}

/** Production and Vercel previews wake the real Render services. Local dev does not. */
export function shouldWakeDirect(hostname: string): boolean {
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return false;
  return hostname === 'rtoshield.tech' || hostname.endsWith('.rtoshield.tech') || hostname.endsWith('.vercel.app');
}

/** The loader covers every page on a host that depends on the sleeping backends. */
export function hostShouldGate(hostname: string): boolean {
  return shouldWakeDirect(hostname);
}

/** Custom domain plus the onrender.com URL, so either front door can spin the instance up. */
export function wakeHoldUrls(direct: { api: string; ml: string } | null): string[] {
  if (!direct) return [];
  const urls = [direct.api, direct.ml];
  if (direct.api === PRODUCTION_API_HEALTH) urls.push(ONRENDER_API_HEALTH);
  if (direct.ml === PRODUCTION_ML_HEALTH) urls.push(ONRENDER_ML_HEALTH);
  return [...new Set(urls.filter(Boolean))];
}

function currentHost(): string {
  if (typeof window === 'undefined') return '';
  return window.location.hostname;
}

/** 2xx with `{ ok: true }`. Render cold-start 502/503/504 and anything else stay down. */
export function responseIsUp(status: number, body: { ok?: boolean } | null): boolean {
  if (status < 200 || status >= 300) return false;
  return body?.ok === true;
}

async function readHealth(fetchImpl: typeof fetch, url: string, timeoutMs: number, mode: RequestMode): Promise<boolean> {
  try {
    const response = await fetchImpl(url, {
      mode,
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = (await response.json().catch(() => null)) as { ok?: boolean } | null;
    return responseIsUp(response.status, body);
  } catch {
    return false;
  }
}

type Hold = { controller: AbortController };
const holds = new Map<string, Hold>();

/**
 * One in-flight no-cors request per URL. It is not tied to the short readiness
 * timeout, so closing a poll cannot cancel the spin-up. keepalive lets the
 * request survive a navigation. Opaque responses are ignored; readiness is separate.
 */
export function holdWake(url: string, fetchImpl: typeof fetch = fetch, holdMs = WAKE_HOLD_MS): void {
  if (!url || holds.has(url)) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), holdMs);
  holds.set(url, { controller });
  void fetchImpl(url, {
    mode: 'no-cors',
    cache: 'no-store',
    credentials: 'omit',
    keepalive: true,
    signal: controller.signal,
  })
    .catch(() => undefined)
    .finally(() => {
      clearTimeout(timer);
      const current = holds.get(url);
      if (current?.controller === controller) holds.delete(url);
    });
}

export function resetWakeHolds(): void {
  for (const hold of holds.values()) hold.controller.abort();
  holds.clear();
}

export type ProbeOptions = {
  hostname?: string;
  /** Force these direct URLs, including in tests. Null skips them. */
  targets?: { api: string; ml: string } | null;
  readTimeoutMs?: number;
  holdTimeoutMs?: number;
};

/**
 * Wake both Render services from the browser, then ask whether they are healthy.
 * Direct no-cors requests hit the public health URLs even when CORS or the proxy
 * would drop the response. Readiness accepts either that direct JSON or the
 * same-origin proxy, so a 502 page does not count as up.
 */
export async function probeWake(fetchImpl: typeof fetch = fetch, options: ProbeOptions = {}): Promise<WakeSnapshot> {
  const hostname = options.hostname ?? currentHost();
  const readTimeoutMs = options.readTimeoutMs ?? WAKE_PING_MS;
  const holdTimeoutMs = options.holdTimeoutMs ?? WAKE_HOLD_MS;
  const direct = options.targets !== undefined ? options.targets : shouldWakeDirect(hostname) ? productionHealthUrls() : null;
  for (const url of wakeHoldUrls(direct)) holdWake(url, fetchImpl, holdTimeoutMs);
  const [viaProxyApi, viaProxyMl, viaDirectApi, viaDirectMl] = await Promise.all([
    readHealth(fetchImpl, '/api/health', readTimeoutMs, 'same-origin'),
    readHealth(fetchImpl, '/api/health/ml', readTimeoutMs, 'same-origin'),
    direct?.api ? readHealth(fetchImpl, direct.api, readTimeoutMs, 'cors') : Promise.resolve(false),
    direct?.ml ? readHealth(fetchImpl, direct.ml, readTimeoutMs, 'cors') : Promise.resolve(false),
  ]);
  return { api: viaProxyApi || viaDirectApi, ml: viaProxyMl || viaDirectMl };
}

/** Inline script for the first paint. Holds a direct request open before React hydrates. */
export function landingWakeScript(): string {
  const urls = wakeHoldUrls(productionHealthUrls());
  return `(function(){
var host=location.hostname;
if(host==='localhost'||host==='127.0.0.1')return;
if(host!=='rtoshield.tech'&&!host.endsWith('.rtoshield.tech')&&!host.endsWith('.vercel.app'))return;
var urls=${JSON.stringify(urls)};
var pending={};
function arm(url){
if(pending[url])return;
pending[url]=1;
var done=function(){pending[url]=0;};
var init={mode:'no-cors',cache:'no-store',credentials:'omit',keepalive:true};
if(typeof AbortSignal!=='undefined'&&AbortSignal.timeout)init.signal=AbortSignal.timeout(${WAKE_HOLD_MS});
fetch(url,init).then(done,done);
}
function kick(){urls.forEach(arm);}
kick();
var n=0;
var timer=setInterval(function(){n+=1;if(n>24){clearInterval(timer);return;}kick();},5000);
})();`;
}
