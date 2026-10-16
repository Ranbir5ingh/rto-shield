import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { runInNewContext } from 'node:vm';
import {
  ONRENDER_API_HEALTH,
  ONRENDER_ML_HEALTH,
  PRODUCTION_API_HEALTH,
  PRODUCTION_ML_HEALTH,
  WAKE_HOLD_MS,
  WAKE_TIMEOUT_MS,
  formatElapsed,
  hostShouldGate,
  initialWake,
  landingWakeScript,
  probeWake,
  resetWakeHolds,
  responseIsUp,
  routeNeedsApi,
  shouldWakeDirect,
  stepWake,
  wakeDelayMs,
  wakeMessage,
  wakeProgress,
} from './wake';

function json(status: number, body: unknown): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': typeof body === 'string' ? 'text/html' : 'application/json' },
  });
}

describe('wake helpers', () => {
  const previousMl = process.env.NEXT_PUBLIC_ML_HEALTH_URL;
  const previousApi = process.env.NEXT_PUBLIC_API_HEALTH_URL;

  afterEach(() => {
    resetWakeHolds();
    if (previousMl === undefined) delete process.env.NEXT_PUBLIC_ML_HEALTH_URL;
    else process.env.NEXT_PUBLIC_ML_HEALTH_URL = previousMl;
    if (previousApi === undefined) delete process.env.NEXT_PUBLIC_API_HEALTH_URL;
    else process.env.NEXT_PUBLIC_API_HEALTH_URL = previousApi;
  });

  it('gates login, signup, and the app, and leaves a local landing page open', () => {
    expect(routeNeedsApi('/')).toBe(false);
    expect(routeNeedsApi('/privacy')).toBe(false);
    expect(routeNeedsApi('/login')).toBe(true);
    expect(routeNeedsApi('/signup')).toBe(true);
    expect(routeNeedsApi('/app/queue')).toBe(true);
    expect(hostShouldGate('localhost')).toBe(false);
    expect(hostShouldGate('www.rtoshield.tech')).toBe(true);
    expect(hostShouldGate('rto-shield-teal.vercel.app')).toBe(true);
    expect(shouldWakeDirect('127.0.0.1')).toBe(false);
  });

  it('backs off from 3 seconds to 5', () => {
    expect(wakeDelayMs(0)).toBe(3000);
    expect(wakeDelayMs(1)).toBe(4000);
    expect(wakeDelayMs(2)).toBe(5000);
    expect(wakeDelayMs(8)).toBe(5000);
  });

  it('rotates honest messages and names the model once the API is up', () => {
    expect(wakeMessage(0, false)).toMatch(/free hosting naps/);
    expect(wakeMessage(4500, false)).toMatch(/risk model/);
    expect(wakeMessage(1000, true)).toMatch(/risk model/);
    expect(wakeMessage(70_000, true)).toMatch(/over a minute/);
  });

  it('formats elapsed time and moves the progress bar by stage', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(65_000)).toBe('1:05');
    const cold = wakeProgress(10_000, { api: false, ml: false });
    const apiOnly = wakeProgress(10_000, { api: true, ml: false });
    expect(apiOnly).toBeGreaterThan(cold);
    expect(wakeProgress(10_000, { api: true, ml: true })).toBe(1);
  });

  it('treats 502, 503, 504, and a missing ok flag as still down', () => {
    expect(responseIsUp(502, { ok: false })).toBe(false);
    expect(responseIsUp(503, null)).toBe(false);
    expect(responseIsUp(504, { ok: false })).toBe(false);
    expect(responseIsUp(200, { ok: false })).toBe(false);
    expect(responseIsUp(200, null)).toBe(false);
    expect(responseIsUp(200, { ok: true })).toBe(true);
  });

  it('keeps the loader until both backends answer, then clears it', () => {
    let step = stepWake(initialWake(), { api: false, ml: false }, 1_000);
    expect(step.machine.phase).toBe('checking');
    expect(step.waitMs).toBe(3_000);

    step = stepWake(step.machine, { api: true, ml: false }, 5_000);
    expect(step.machine.phase).toBe('checking');
    expect(step.machine.snap).toEqual({ api: true, ml: false });
    expect(step.waitMs).toBe(4_000);

    step = stepWake(step.machine, { api: false, ml: true }, 12_000);
    expect(step.machine.phase).toBe('checking');
    expect(step.waitMs).toBe(5_000);

    step = stepWake(step.machine, { api: true, ml: true }, 20_000);
    expect(step.machine.phase).toBe('ready');
    expect(step.waitMs).toBe(0);
  });

  it('fails the loader after the timeout while either backend is still down', () => {
    const cold = stepWake(initialWake(), { api: false, ml: false }, WAKE_TIMEOUT_MS + 1);
    expect(cold.machine.phase).toBe('failed');
    const apiOnly = stepWake(initialWake(), { api: true, ml: false }, WAKE_TIMEOUT_MS + 1);
    expect(apiOnly.machine.phase).toBe('failed');
  });

  it('accepts a success that arrives after the timeout', () => {
    const step = stepWake(initialWake(), { api: true, ml: true }, WAKE_TIMEOUT_MS + 5_000);
    expect(step.machine.phase).toBe('ready');
  });

  it('wakes both services directly on the production host, even when the proxy is still cold', async () => {
    delete process.env.NEXT_PUBLIC_ML_HEALTH_URL;
    delete process.env.NEXT_PUBLIC_API_HEALTH_URL;
    const seen: Array<{ url: string; mode?: string; keepalive?: boolean }> = [];
    const snap = await probeWake(
      async (input, init) => {
        const url = String(input);
        seen.push({ url, mode: init?.mode, keepalive: init?.keepalive });
        if (url === '/api/health') return json(502, '<html>bad gateway</html>');
        if (url === '/api/health/ml') return json(503, '<html>502</html>');
        if (
          url === PRODUCTION_API_HEALTH ||
          url === PRODUCTION_ML_HEALTH ||
          url === ONRENDER_API_HEALTH ||
          url === ONRENDER_ML_HEALTH
        ) {
          if (init?.mode === 'no-cors') return json(0, null);
          return json(200, { ok: true });
        }
        throw new Error(url);
      },
      { hostname: 'www.rtoshield.tech' },
    );
    const wakes = seen.filter((call) => call.mode === 'no-cors');
    expect(wakes.map((call) => call.url)).toEqual([
      PRODUCTION_API_HEALTH,
      PRODUCTION_ML_HEALTH,
      ONRENDER_API_HEALTH,
      ONRENDER_ML_HEALTH,
    ]);
    expect(wakes.every((call) => call.keepalive)).toBe(true);
    expect(snap).toEqual({ api: true, ml: true });
  });

  it('does not ping production from localhost when the public URL is unset', async () => {
    delete process.env.NEXT_PUBLIC_ML_HEALTH_URL;
    const seen: string[] = [];
    const snap = await probeWake(
      async (input) => {
        const url = String(input);
        seen.push(url);
        if (url === '/api/health') return json(200, { ok: true });
        return json(200, { ok: true });
      },
      { hostname: 'localhost' },
    );
    expect(seen).toEqual(['/api/health', '/api/health/ml']);
    expect(snap).toEqual({ api: true, ml: true });
  });

  it('stays down when every ping fails or times out', async () => {
    const snap = await probeWake(
      async () => {
        const error = new Error('The operation was aborted');
        error.name = 'TimeoutError';
        throw error;
      },
      { hostname: 'www.rtoshield.tech' },
    );
    expect(snap).toEqual({ api: false, ml: false });
  });

  it('embeds direct no-cors wakes for both Render URLs in the first-paint script', () => {
    delete process.env.NEXT_PUBLIC_ML_HEALTH_URL;
    delete process.env.NEXT_PUBLIC_API_HEALTH_URL;
    const script = landingWakeScript();
    expect(script).toContain(PRODUCTION_API_HEALTH);
    expect(script).toContain(PRODUCTION_ML_HEALTH);
    expect(script).toContain(ONRENDER_API_HEALTH);
    expect(script).toContain(ONRENDER_ML_HEALTH);
    expect(script).toContain("mode:'no-cors'");
    expect(script).toContain('keepalive:true');
    expect(script).toContain(String(WAKE_HOLD_MS));
    expect(script).toContain("host==='localhost'");
    expect(script).toContain("endsWith('.rtoshield.tech')");
    expect(firedHosts('www.rtoshield.tech')).toEqual([
      PRODUCTION_API_HEALTH,
      PRODUCTION_ML_HEALTH,
      ONRENDER_API_HEALTH,
      ONRENDER_ML_HEALTH,
    ]);
    expect(firedHosts('localhost')).toEqual([]);
    expect(firedHosts('example.com')).toEqual([]);
  });

  it('a short abort does not wake a cold service, and a held request does', async () => {
    const sleeper = await startSleeper(400);
    try {
      const aborted = new AbortController();
      const early = setTimeout(() => aborted.abort(), 80);
      await fetch(sleeper.url, { signal: aborted.signal }).catch(() => undefined);
      clearTimeout(early);
      await new Promise((resolve) => setTimeout(resolve, 450));
      expect(sleeper.isAwake()).toBe(false);

      const snap = await probeWake(fetch, {
        hostname: 'localhost',
        targets: { api: sleeper.url, ml: sleeper.url },
        readTimeoutMs: 80,
        holdTimeoutMs: 2_000,
      });
      expect(snap).toEqual({ api: false, ml: false });
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(sleeper.isAwake()).toBe(true);

      resetWakeHolds();
      const ready = await probeWake(fetch, {
        hostname: 'localhost',
        targets: { api: sleeper.url, ml: sleeper.url },
        readTimeoutMs: 1_000,
        holdTimeoutMs: 2_000,
      });
      expect(ready).toEqual({ api: true, ml: true });
    } finally {
      resetWakeHolds();
      await sleeper.close();
    }
  });
});

function firedHosts(hostname: string): string[] {
  const urls: string[] = [];
  runInNewContext(landingWakeScript(), {
    location: { hostname },
    fetch: (url: string) => {
      urls.push(url);
      return Promise.resolve();
    },
    setInterval: () => 0,
    clearInterval: () => undefined,
    AbortSignal: { timeout: () => ({}) },
  });
  return urls;
}

function startSleeper(holdMs: number): Promise<{ url: string; isAwake: () => boolean; close: () => Promise<void> }> {
  let awake = false;
  const server = createServer((req, res) => {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('content-type', 'application/json');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (awake) {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    let finished = false;
    const timer = setTimeout(() => {
      finished = true;
      awake = true;
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
    }, holdMs);
    const cancel = () => {
      if (!finished) clearTimeout(timer);
    };
    req.on('aborted', cancel);
    req.on('close', cancel);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        url: `http://127.0.0.1:${port}/health`,
        isAwake: () => awake,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}
