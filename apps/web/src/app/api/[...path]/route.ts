import { NextRequest, NextResponse } from 'next/server';
import { observedClientIp } from '@/lib/proxy-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
  'content-encoding',
  'accept-encoding',
]);

const UPSTREAM_MS = 55_000;
/**
 * Readiness only. The browser wakes Render directly and holds that connection
 * open; this proxy must not be the thing that keeps the cold start alive.
 * Stay under the 10s hobby limit so a sleeping upstream cannot kill the function first.
 */
const HEALTH_UPSTREAM_MS = 9_000;

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const api = (process.env.API_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
  const target = `${api}/api/${path.join('/')}${request.nextUrl.search}`;
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  // Render's proxy replaces the chain, so Express would otherwise see Vercel's egress IP.
  const client = observedClientIp(request.headers.get('x-forwarded-for'), request.headers.get('x-real-ip'));
  if (client) headers.set('x-rto-client-ip', client);
  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
    cache: 'no-store',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = Buffer.from(await request.arrayBuffer());
  }

  const timeoutMs = path[0] === 'health' ? HEALTH_UPSTREAM_MS : UPSTREAM_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let upstream: Response;
  try {
    upstream = await fetch(target, { ...init, signal: controller.signal });
  } catch (error) {
    const aborted = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError');
    return NextResponse.json(
      {
        ok: false,
        error: aborted
          ? 'The API took too long to answer. Try again in a moment.'
          : 'The API did not respond. It may still be waking up.',
      },
      { status: 504, headers: { 'cache-control': 'no-store' } },
    );
  } finally {
    clearTimeout(timer);
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie' || HOP.has(key.toLowerCase())) return;
    responseHeaders.set(key, value);
  });
  responseHeaders.set('cache-control', 'no-store');
  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
  const cookies = typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : [];
  for (const cookie of cookies) response.headers.append('set-cookie', cookie);
  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
