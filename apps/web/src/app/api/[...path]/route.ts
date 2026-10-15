import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'host', 'content-length']);

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const api = process.env.API_URL || 'http://127.0.0.1:4000';
  const target = `${api}/api/${path.join('/')}${request.nextUrl.search}`;
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  const init: RequestInit = { method: request.method, headers, redirect: 'manual' };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = Buffer.from(await request.arrayBuffer());
  }
  const upstream = await fetch(target, init);
  const response = new NextResponse(upstream.body, { status: upstream.status });
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie' || HOP.has(key.toLowerCase())) return;
    response.headers.set(key, value);
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
