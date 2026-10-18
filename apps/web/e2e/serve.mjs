/**
 * Boots an in-memory API and the built Next server for Playwright.
 * Run `npm run build` first. No production secrets.
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(webRoot, '../..');
const API_PORT = '4103';
const WEB_PORT = '3103';
const ML_PORT = 8100;
const API = `http://127.0.0.1:${API_PORT}`;
const OWNER = { email: 'e2e-owner@shop.test', password: 'e2e-owner-pass', name: 'E2E Owner', shopName: 'E2E Shop' };
const DEMO = { email: 'e2e-demo@shop.test', password: 'e2e-demo-pass', name: 'E2E Demo', shopName: 'E2E Demo Shop' };

const children = [];

function listen(port) {
  const server = createServer((req, res) => {
    const url = req.url || '';
    // The wake screen stays up until GET /health answers { ok: true }. Scoring still 503s so the API uses rules.
    if (req.method === 'GET' && (url === '/health' || url.startsWith('/health?'))) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        gemini: false,
        gemma_ready: false,
        ollama_configured: false,
        active_predictor: 'sklearn',
        tabpfn_token: false,
        tabpfn_client_installed: false,
        tabpfn_local_installed: false,
      }));
      return;
    }
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end('{"ok":false}');
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

async function waitFor(url, attempts = 80) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* still booting */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function remember(jar, response) {
  const lines = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  for (const line of lines) {
    const pair = line.split(';')[0] || '';
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

async function call(jar, pathname, { method = 'GET', body, csrf } = {}) {
  const headers = { accept: 'application/json' };
  if (body) headers['content-type'] = 'application/json';
  if (csrf) headers['x-csrf-token'] = csrf;
  const cookie = [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
  if (cookie) headers.cookie = cookie;
  const response = await fetch(`${API}${pathname}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  remember(jar, response);
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${method} ${pathname} ${response.status} ${text.slice(0, 180)}`);
  return json;
}

async function seedShop(jar, account) {
  const csrf = await call(jar, '/api/auth/csrf');
  const signup = await call(jar, '/api/auth/signup', { method: 'POST', body: account, csrf: csrf.csrfToken });
  await call(jar, '/api/orders/sample', { method: 'POST', csrf: signup.csrfToken });
  await call(jar, '/api/orders/score', { method: 'POST', csrf: signup.csrfToken });
}

async function main() {
  await listen(ML_PORT);
  const memory = await MongoMemoryServer.create();
  const uri = memory.getUri('e2e');
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    PORT: API_PORT,
    MONGODB_URI: uri,
    MONGODB_MODE: 'configured',
    JWT_SECRET: 'e2e-jwt-secret-not-production',
    COOKIE_SECURE: 'false',
    BCRYPT_ROUNDS: '4',
    AUTH_RATE_LIMIT_MAX: '5000',
    RATE_LIMIT_MAX: '5000',
    DEMO_ACCOUNT_EMAIL: DEMO.email,
    ML_SERVICE_URL: `http://127.0.0.1:${ML_PORT}`,
    WHATSAPP_VERIFY_TOKEN: 'e2e-webhook-verify-secret',
    ELEVENLABS_API_KEY: '',
    ELEVENLABS_AGENT_ID: '',
  };
  const api = spawn(process.execPath, [path.join(repoRoot, 'apps/api/dist/main.js')], {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  });
  children.push(api);
  api.on('exit', (code) => {
    if (code) process.exit(code);
  });
  await waitFor(`${API}/api/health`);
  await seedShop(new Map(), OWNER);
  await seedShop(new Map(), DEMO);
  await mongoose.connect(uri);
  const marked = await mongoose.connection.collection('users').updateOne(
    { email: DEMO.email },
    {
      $set: {
        shopify: {
          shopDomain: 'e2e-demo.myshopify.com',
          demo: true,
          scopes: 'read_orders',
          tokenEnvelope: null,
          installedAt: new Date().toISOString(),
          uninstalledAt: null,
          backfill: { status: 'done', processed: 12, total: 12, error: null },
          riskTags: { high: 'rto-high', medium: 'rto-medium', low: 'rto-low' },
          rtoTag: 'RTO',
          autoCancelOnBuyerCancel: false,
        },
      },
    },
  );
  if (!marked.matchedCount) throw new Error('Demo shop was not marked connected');
  await mongoose.disconnect();

  const web = spawn('npx', ['next', 'start', '--hostname', '127.0.0.1', '--port', WEB_PORT], {
    cwd: webRoot,
    env: { ...process.env, API_URL: API, PORT: WEB_PORT },
    stdio: 'inherit',
  });
  children.push(web);
  web.on('exit', (code) => process.exit(code || 0));
}

function shutdown() {
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(0), 400);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch((error) => {
  console.error(error);
  shutdown();
  process.exit(1);
});
