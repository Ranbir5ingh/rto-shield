import { closeServer, startBootHealth } from './boot-health';

describe('boot health', () => {
  it('answers GET /api/health with no database and refuses other paths', async () => {
    const server = await startBootHealth(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    try {
      const health = await fetch(`http://127.0.0.1:${port}/api/health`);
      expect(health.status).toBe(200);
      await expect(health.json()).resolves.toEqual({ ok: true, service: 'rto-shield-api' });
      const deep = await fetch(`http://127.0.0.1:${port}/api/health/deep`);
      expect(deep.status).toBe(503);
      const ml = await fetch(`http://127.0.0.1:${port}/api/health/ml`);
      expect(ml.status).toBe(503);
    } finally {
      await closeServer(server);
    }
  });
});
