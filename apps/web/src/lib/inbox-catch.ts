import { createCipheriv, randomBytes, scryptSync } from 'crypto';
import { MongoClient } from 'mongodb';

let client: MongoClient | null = null;

function encryptionKey() {
  const raw = process.env.ENCRYPTION_KEY?.trim() || '';
  if (!raw) return null;
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length === 32 && !/^[0-9a-f]+$/i.test(raw)) return decoded;
  return scryptSync(raw, 'rto-shield', 32);
}

function encrypt(plain: string) {
  const key = encryptionKey();
  if (!key) throw new Error('ENCRYPTION_KEY');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${data.toString('base64url')}`;
}

async function collection() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error('MONGODB_URI');
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  return client.db().collection('inbox');
}

export async function acceptInbox(input: {
  webhookId: string;
  provider: 'shopify' | 'whatsapp';
  topic: string;
  shop: string;
  payload: string;
}) {
  const inbox = await collection();
  await inbox.updateOne(
    { webhookId: input.webhookId },
    {
      $setOnInsert: {
        webhookId: input.webhookId,
        provider: input.provider,
        topic: input.topic.slice(0, 80),
        shop: input.shop.slice(0, 200),
        payloadEnc: encrypt(input.payload),
        status: 'pending',
        attempts: 0,
        receivedAt: new Date(),
        processedAt: null,
        error: '',
      },
    },
    { upsert: true },
  );
}

export async function pingDrain() {
  const secret = process.env.INBOX_DRAIN_SECRET?.trim();
  const api = (process.env.API_URL || '').replace(/\/$/, '');
  if (!secret || !api) return;
  await fetch(`${api}/api/inbox/drain`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-inbox-secret': secret },
    body: '{}',
    signal: AbortSignal.timeout(2500),
  }).catch(() => undefined);
}
