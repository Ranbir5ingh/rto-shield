import { createServer, type Server } from 'http';

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
};

/**
 * Answers GET /api/health before Nest finishes booting, including while MongoDB is still connecting.
 * Every other path is 503 until the real server takes the port.
 */
export function startBootHealth(port: number): Promise<Server> {
  const server = createServer((req, res) => {
    const path = (req.url || '').split('?')[0];
    if (path === '/api/health' && (req.method === 'GET' || req.method === 'OPTIONS')) {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, HEADERS);
        res.end();
        return;
      }
      res.writeHead(200, HEADERS);
      res.end(JSON.stringify({ ok: true, service: 'rto-shield-api' }));
      return;
    }
    res.writeHead(503, HEADERS);
    res.end(JSON.stringify({ ok: false, error: 'starting' }));
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => resolve(server));
  });
}

export function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}
