import {
  WAKE_TIMEOUT_MS,
  formatElapsed,
  initialWake,
  landingWakeScript,
  probeWake,
  responseIsUp,
  routeNeedsApi,
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
  const previous = process.env.NEXT_PUBLIC_ML_HEALTH_URL;

  afterEach(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_ML_HEALTH_URL;
    else process.env.NEXT_PUBLIC_ML_HEALTH_URL = previous;
  });

  it('gates login, signup, and the app, and leaves the landing page open', () => {
    expect(routeNeedsApi('/')).toBe(false);
    expect(routeNeedsApi('/privacy')).toBe(false);
    expect(routeNeedsApi('/login')).toBe(true);
    expect(routeNeedsApi('/signup')).toBe(true);
    expect(routeNeedsApi('/app/queue')).toBe(true);
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

  it('counts a direct ML health ping when the pass-through is still cold', async () => {
    process.env.NEXT_PUBLIC_ML_HEALTH_URL = 'https://ml.rtoshield.tech/health';
    const seen: string[] = [];
    const snap = await probeWake(async (input) => {
      const url = String(input);
      seen.push(url);
      if (url === '/api/health') return json(200, { ok: true });
      if (url === '/api/health/ml') return json(503, '<html>502</html>');
      if (url === 'https://ml.rtoshield.tech/health') return json(200, { ok: true });
      throw new Error(url);
    });
    expect(seen).toEqual(['/api/health', '/api/health/ml', 'https://ml.rtoshield.tech/health']);
    expect(snap).toEqual({ api: true, ml: true });
  });

  it('stays down when the API returns 502 and the ML ping times out', async () => {
    process.env.NEXT_PUBLIC_ML_HEALTH_URL = 'https://ml.rtoshield.tech/health';
    const snap = await probeWake(async (input) => {
      const url = String(input);
      if (url === '/api/health') return json(502, '<html>bad gateway</html>');
      if (url === '/api/health/ml') return json(200, { ok: false });
      const error = new Error('The operation was aborted');
      error.name = 'TimeoutError';
      throw error;
    });
    expect(snap).toEqual({ api: false, ml: false });
  });

  it('wakes ML through the pass-through when no public URL is set', async () => {
    delete process.env.NEXT_PUBLIC_ML_HEALTH_URL;
    const seen: string[] = [];
    const snap = await probeWake(async (input) => {
      const url = String(input);
      seen.push(url);
      if (url === '/api/health') return json(200, { ok: true });
      return json(200, { ok: true });
    });
    expect(seen).toEqual(['/api/health', '/api/health/ml']);
    expect(snap).toEqual({ api: true, ml: true });
  });

  it('fires the API and ML pings from the landing script', () => {
    const script = landingWakeScript('https://ml.rtoshield.tech/health');
    expect(script).toContain("fetch('/api/health'");
    expect(script).toContain("fetch('/api/health/ml'");
    expect(script).toContain('https://ml.rtoshield.tech/health');
    expect(landingWakeScript('')).not.toContain('ml.rtoshield.tech');
  });
});
