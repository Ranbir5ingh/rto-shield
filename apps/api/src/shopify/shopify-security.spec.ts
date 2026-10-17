import { createHmac } from 'crypto';
import { last4, open, seal, shopifyOauthHmac, verifyMetaSignature, verifyShopifyOauth, verifyShopifyWebhook } from '@rto/vault';
import { mapGraphqlOrder, mapRestOrder, normalizeShop } from './shopify-map';

const MASTER = 'a'.repeat(64);

describe('envelope encryption', () => {
  it('seals with a data key and refuses the wrong master key', () => {
    const envelope = seal('shpat_live_token_9876', MASTER);
    expect(envelope.v).toBe(1);
    expect(envelope.data).not.toContain('shpat');
    expect(open(envelope, MASTER)).toBe('shpat_live_token_9876');
    expect(last4('shpat_live_token_9876')).toBe('9876');
    expect(() => open(envelope, 'b'.repeat(64))).toThrow();
  });
});

describe('shopify hmac', () => {
  const secret = 'shopify-test-secret';

  it('checks the OAuth query without hmac or signature', () => {
    const query = { code: 'abc', shop: 'demo-store.myshopify.com', state: 'state-1', timestamp: '1710000000' };
    const hmac = shopifyOauthHmac(query, secret);
    expect(verifyShopifyOauth({ ...query, hmac, signature: 'ignored' }, secret)).toBe(true);
    expect(verifyShopifyOauth({ ...query, hmac: 'deadbeef' }, secret)).toBe(false);
    expect(verifyShopifyOauth({ ...query, hmac }, '')).toBe(false);
  });

  it('checks the webhook body hmac', () => {
    const raw = '{"id":9}';
    const header = createHmac('sha256', secret).update(raw).digest('base64');
    expect(verifyShopifyWebhook(raw, header, secret)).toBe(true);
    expect(verifyShopifyWebhook(raw, header, 'other')).toBe(false);
    expect(verifyShopifyWebhook(`${raw} `, header, secret)).toBe(false);
  });
});

describe('meta signature', () => {
  it('requires sha256 of the raw body', () => {
    const raw = '{"entry":[]}';
    const header = `sha256=${createHmac('sha256', 'meta-secret').update(raw).digest('hex')}`;
    expect(verifyMetaSignature(raw, header, 'meta-secret')).toBe(true);
    expect(verifyMetaSignature(raw, header, '')).toBe(false);
  });
});

describe('shopify order mapping', () => {
  it('normalizes a shop domain', () => {
    expect(normalizeShop('Demo-Store')).toBe('demo-store.myshopify.com');
    expect(normalizeShop('https://demo-store.myshopify.com/admin')).toBe('demo-store.myshopify.com');
    expect(normalizeShop('not a shop')).toBeNull();
  });

  it('treats a failed delivery, a seller tag, and a refund after fulfillment as RTO', () => {
    const failed = mapRestOrder(
      {
        id: 11,
        name: '#11',
        financial_status: 'paid',
        fulfillment_status: 'fulfilled',
        fulfillments: [{ shipment_status: 'failure', tracking_company: 'Delhivery' }],
        shipping_address: { zip: '110001', city: 'Delhi', name: 'Asha' },
        total_price: '799',
        created_at: '2026-01-01T00:00:00Z',
      },
      'RTO',
    );
    expect(failed?.outcome).toBe('rto');
    expect(failed?.pincode).toBe('110001');

    const tagged = mapRestOrder(
      {
        id: 12,
        tags: 'vip, RTO',
        financial_status: 'paid',
        fulfillments: [{ shipment_status: 'delivered' }],
        shipping_address: { zip: '560001' },
        total_price: '100',
        created_at: '2026-01-01T00:00:00Z',
      },
      'RTO',
    );
    expect(tagged?.outcome).toBe('rto');

    const refunded = mapGraphqlOrder(
      {
        id: 'gid://shopify/Order/13',
        name: '#13',
        createdAt: '2026-01-01T00:00:00Z',
        displayFinancialStatus: 'REFUNDED',
        displayFulfillmentStatus: 'FULFILLED',
        tags: [],
        paymentGatewayNames: ['cash on delivery'],
        totalPriceSet: { shopMoney: { amount: '500' } },
        shippingAddress: { zip: '400001', city: 'Mumbai' },
        fulfillments: [{ displayStatus: 'DELIVERED' }],
        refunds: [{ id: 'r1' }],
      },
      'RTO',
    );
    expect(refunded?.outcome).toBe('rto');
    expect(refunded?.paymentType).toBe('cod');
  });

  it('keeps a cancel before fulfillment as cancelled, not RTO', () => {
    const cancelled = mapRestOrder(
      {
        id: 14,
        cancelled_at: '2026-01-02T00:00:00Z',
        financial_status: 'pending',
        payment_gateway_names: ['Cash on Delivery (COD)'],
        fulfillments: [],
        shipping_address: { zip: '560001' },
        total_price: '10',
        created_at: '2026-01-01T00:00:00Z',
      },
      'RTO',
    );
    expect(cancelled?.outcome).toBe('cancelled');
    expect(cancelled?.paymentType).toBe('cod');
  });
});
