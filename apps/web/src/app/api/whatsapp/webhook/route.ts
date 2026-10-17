import { open, verifyMetaSignature } from '@rto/vault';
import { createHash } from 'crypto';
import { MongoClient } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { acceptInbox, pingDrain } from '@/lib/inbox-catch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

let client: MongoClient | null = null;

function phoneNumberId(body: Record<string, unknown>) {
  const entries = Array.isArray(body.entry) ? (body.entry as Array<Record<string, unknown>>) : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? (entry.changes as Array<Record<string, unknown>>) : [];
    for (const change of changes) {
      const value = (change.value || {}) as { metadata?: { phone_number_id?: string } };
      if (value.metadata?.phone_number_id) return String(value.metadata.phone_number_id);
    }
  }
  return '';
}

async function appSecret(phoneId: string) {
  const uri = process.env.MONGODB_URI?.trim();
  const master = process.env.KEY_ENCRYPTION_KEY?.trim();
  if (!uri || !master || !phoneId) return '';
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  const user = await client.db().collection('users').findOne({ 'whatsapp.phoneNumberId': phoneId });
  const envelope = user?.whatsapp?.appSecretEnvelope as Parameters<typeof open>[0] | null;
  if (!envelope) return '';
  try {
    return open(envelope, master);
  } catch {
    return '';
  }
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge') || '';
  const expected = process.env.WHATSAPP_VERIFY_TOKEN?.trim() || '';
  if (mode !== 'subscribe' || !expected || token !== expected || !challenge) {
    return new NextResponse('forbidden', { status: 403 });
  }
  await markWebhookVerified();
  return new NextResponse(challenge, { status: 200, headers: { 'content-type': 'text/plain' } });
}

async function markWebhookVerified() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) return;
  try {
    if (!client) {
      client = new MongoClient(uri);
      await client.connect();
    }
    await client.db().collection('platform').updateOne(
      { key: 'whatsapp.webhookVerifiedAt' },
      { $set: { key: 'whatsapp.webhookVerifiedAt', value: new Date().toISOString() } },
      { upsert: true },
    );
  } catch {
    // Meta still needs the challenge. The seller can verify again.
  }
}

export async function POST(request: NextRequest) {
  const raw = Buffer.from(await request.arrayBuffer());
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const phoneId = phoneNumberId(body);
  const secret = await appSecret(phoneId);
  const signature = request.headers.get('x-hub-signature-256') || '';
  if (!secret || !verifyMetaSignature(raw, signature, secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    await acceptInbox({
      webhookId: createHash('sha256').update(raw).digest('hex'),
      provider: 'whatsapp',
      topic: 'messages',
      shop: phoneId,
      payload: raw.toString('utf8'),
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  await pingDrain();
  return NextResponse.json({ ok: true });
}
