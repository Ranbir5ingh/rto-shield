import {
  PROTECTED_CUSTOMER_DATA,
  SHOPIFY_API_WEBHOOK_TOPICS,
  SHOPIFY_CONFIG_ONLY_TOPICS,
  SHOPIFY_IMPORT_FAILED,
  explainShopify,
  sanitizeShopifyText,
  topicsToRegister,
  webhookAlreadyRegistered,
} from './shopify-errors';

describe('shopify error explanations', () => {
  it('maps protected customer data to a seller-facing reason and keeps the code in the log', () => {
    const phone = '9812345678';
    const explained = explainShopify({
      errors: [
        {
          message: `This app is not approved to access the Customer object. Phone ${phone} email buyer@example.com shpat_live_secret`,
          extensions: { code: 'ACCESS_DENIED' },
        },
      ],
    });
    expect(explained.seller).toBe(PROTECTED_CUSTOMER_DATA);
    expect(explained.log).toContain('ACCESS_DENIED');
    expect(explained.log).not.toContain(phone);
    expect(explained.log).not.toContain('buyer@example.com');
    expect(explained.log).not.toContain('shpat_live_secret');
    expect(explained.log).toContain('[number]');
    expect(explained.log).toContain('[email]');
    expect(explained.log).toContain('[token]');
  });

  it('reads a string errors body and userErrors without treating an existing webhook as new', () => {
    const explained = explainShopify({
      status: 200,
      errors: 'Throttled',
      userErrors: [{ field: ['webhookSubscription', 'uri'], message: 'Address for this topic has already been taken' }],
    });
    expect(explained.seller).toBe('Shopify is busy. Try the import again in a minute.');
    expect(explained.log).toContain('Throttled');
    expect(explained.log).toContain('webhookSubscription.uri');
    expect(webhookAlreadyRegistered('Address for this topic has already been taken')).toBe(true);
    expect(webhookAlreadyRegistered('Webhook topic is invalid')).toBe(false);
  });

  it('hides tokens from a rejected shop token and from a scrubbed message', () => {
    expect(explainShopify({ status: 401, errors: 'shpat_abc' }).seller).toBe('Reconnect Shopify. The shop token was rejected.');
    expect(explainShopify({ errors: 'Something broke for buyer@example.com' }).seller).toBe(SHOPIFY_IMPORT_FAILED);
    expect(sanitizeShopifyText('Bearer shpss_secret deadbeefdeadbeefdeadbeefdeadbeef')).not.toContain('shpss_secret');
    expect(explainShopify({}).seller).toBe(SHOPIFY_IMPORT_FAILED);
  });

  it('registers order webhooks only, and skips topics that already exist', () => {
    expect(SHOPIFY_API_WEBHOOK_TOPICS).toEqual(expect.arrayContaining(['ORDERS_CREATE', 'ORDERS_UPDATED', 'ORDERS_CANCELLED']));
    for (const topic of SHOPIFY_CONFIG_ONLY_TOPICS) {
      expect(SHOPIFY_API_WEBHOOK_TOPICS).not.toContain(topic);
    }
    expect(topicsToRegister(['ORDERS_CREATE', 'APP_UNINSTALLED'])).toEqual([
      'ORDERS_UPDATED',
      'ORDERS_CANCELLED',
      'FULFILLMENTS_CREATE',
      'FULFILLMENTS_UPDATE',
      'REFUNDS_CREATE',
    ]);
    expect(topicsToRegister(null)).toEqual([...SHOPIFY_API_WEBHOOK_TOPICS]);
  });
});
