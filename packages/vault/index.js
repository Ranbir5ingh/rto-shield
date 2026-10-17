const { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } = require('crypto');

function deriveKey(raw) {
  const value = String(raw || '').trim();
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, 'hex');
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length === 32 && !/^[0-9a-f]+$/i.test(value)) return decoded;
  return scryptSync(value, 'rto-shield-kek', 32);
}

function last4(secret) {
  const text = String(secret || '');
  if (text.length < 4) return '';
  return text.slice(-4);
}

/** AES-256-GCM with a fresh data key, wrapped by the master key. */
function seal(plain, master) {
  const kek = deriveKey(master);
  const dek = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dek, iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const dekIv = randomBytes(12);
  const wrap = createCipheriv('aes-256-gcm', kek, dekIv);
  const wrapped = Buffer.concat([wrap.update(dek), wrap.final()]);
  const dekTag = wrap.getAuthTag();
  return {
    v: 1,
    iv: iv.toString('base64url'),
    tag: tag.toString('base64url'),
    data: data.toString('base64url'),
    dekIv: dekIv.toString('base64url'),
    dekTag: dekTag.toString('base64url'),
    dek: wrapped.toString('base64url'),
    keyVersion: 1,
  };
}

function open(envelope, master) {
  if (!envelope || envelope.v !== 1) throw new Error('Could not read sealed field');
  const kek = deriveKey(master);
  const unwrap = createDecipheriv('aes-256-gcm', kek, Buffer.from(envelope.dekIv, 'base64url'));
  unwrap.setAuthTag(Buffer.from(envelope.dekTag, 'base64url'));
  const dek = Buffer.concat([unwrap.update(Buffer.from(envelope.dek, 'base64url')), unwrap.final()]);
  const decipher = createDecipheriv('aes-256-gcm', dek, Buffer.from(envelope.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.data, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

function shopifyWebhookHmac(raw, secret) {
  return createHmac('sha256', secret).update(raw).digest('base64');
}

function verifyShopifyWebhook(raw, header, secret) {
  if (!header || !secret) return false;
  return safeEqual(shopifyWebhookHmac(raw, secret), header);
}

function shopifyOauthMessage(query) {
  return Object.keys(query)
    .filter((key) => key !== 'hmac' && key !== 'signature')
    .sort()
    .map((key) => `${key}=${Array.isArray(query[key]) ? query[key].join(',') : query[key]}`)
    .join('&');
}

function shopifyOauthHmac(query, secret) {
  return createHmac('sha256', secret).update(shopifyOauthMessage(query)).digest('hex');
}

function verifyShopifyOauth(query, secret) {
  if (!query.hmac || !secret) return false;
  return safeEqual(shopifyOauthHmac(query, secret), String(query.hmac));
}

function metaSignature(raw, secret) {
  return `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
}

function verifyMetaSignature(raw, header, secret) {
  if (!header || !secret) return false;
  return safeEqual(metaSignature(raw, secret), header);
}

module.exports = {
  deriveKey,
  last4,
  seal,
  open,
  safeEqual,
  shopifyWebhookHmac,
  verifyShopifyWebhook,
  shopifyOauthHmac,
  verifyShopifyOauth,
  metaSignature,
  verifyMetaSignature,
};
