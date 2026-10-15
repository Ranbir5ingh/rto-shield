import { formatElapsed, routeNeedsApi, wakeDelayMs, wakeMessage, wakeProgress } from './wake';

describe('wake helpers', () => {
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
});
