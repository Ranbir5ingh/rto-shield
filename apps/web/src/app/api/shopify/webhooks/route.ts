import { verifyShopifyWebhook } from '@rto/vault';
import { NextRequest, NextResponse } from 'next/server';
import { acceptInbox, pingDrain } from '@/lib/inbox-catch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  const raw = Buffer.from(await request.arrayBuffer());
  const secret = process.env.SHOPIFY_API_SECRET?.trim() || '';
  const hmac = request.headers.get('x-shopify-hmac-sha256') || '';
  if (!verifyShopifyWebhook(raw, hmac, secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const webhookId = request.headers.get('x-shopify-webhook-id') || '';
  if (!webhookId) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    await acceptInbox({
      webhookId,
      provider: 'shopify',
      topic: request.headers.get('x-shopify-topic') || 'unknown',
      shop: request.headers.get('x-shopify-shop-domain') || '',
      payload: raw.toString('utf8'),
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  await pingDrain();
  return NextResponse.json({ ok: true });
}
