import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { metaSignature, seal, shopifyOauthHmac } from '@rto/vault';
import { createHmac } from 'crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { AuditEvent } from '../src/database/audit.schema';
import { InboxEvent } from '../src/database/inbox.schema';
import { Order } from '../src/database/order.schema';
import { User } from '../src/database/user.schema';
import { OauthState } from '../src/database/oauth-state.schema';
import { MlService } from '../src/ml/ml.service';

describe('webhook inbox', () => {
  let app: INestApplication;
  let mongo: MongoMemoryServer;
  let inbox: Model<InboxEvent>;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongo.getUri();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MlService)
      .useValue({
        predict: jest.fn(),
        messages: jest.fn(),
        addressNotes: jest.fn(),
        health: jest.fn(async () => null),
      })
      .compile();
    app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
    configureApp(app);
    await app.init();
    inbox = app.get(getModelToken(InboxEvent.name));
    await inbox.syncIndexes();
  });

  afterAll(async () => {
    await app.close();
    await mongo.stop();
  });

  function signed(raw: string) {
    return createHmac('sha256', 'shopify-test-secret').update(raw).digest('base64');
  }

  it('rejects a shopify webhook with a bad hmac', async () => {
    await request(app.getHttpServer())
      .post('/api/shopify/webhooks')
      .set('x-shopify-hmac-sha256', 'nope')
      .set('x-shopify-webhook-id', 'wh-bad')
      .set('content-type', 'application/json')
      .send('{"id":1}')
      .expect(401);
    expect(await inbox.countDocuments({ webhookId: 'wh-bad' })).toBe(0);
  });

  it('stores one inbox row when the same webhook id is delivered twice', async () => {
    const raw = JSON.stringify({ id: 42, shipping_address: { zip: '110001' }, total_price: '10', created_at: '2026-01-01T00:00:00Z' });
    const post = () =>
      request(app.getHttpServer())
        .post('/api/shopify/webhooks')
        .set('x-shopify-hmac-sha256', signed(raw))
        .set('x-shopify-webhook-id', 'wh-42')
        .set('x-shopify-topic', 'orders/create')
        .set('x-shopify-shop-domain', 'missing-shop.myshopify.com')
        .set('content-type', 'application/json')
        .send(raw);
    const first = await post().expect(200);
    const second = await post().expect(200);
    expect(first.body.duplicate).toBe(false);
    expect(second.body.duplicate).toBe(true);
    expect(await inbox.countDocuments({ webhookId: 'wh-42' })).toBe(1);
  });

  it('rejects an oauth callback whose hmac does not match', async () => {
    const query = { code: 'c', shop: 'demo-store.myshopify.com', state: 'missing', timestamp: '1710000000' };
    await request(app.getHttpServer())
      .get('/api/shopify/callback')
      .query({ ...query, hmac: 'dead' })
      .expect(401);
  });

  it('rejects a signed oauth callback when the state was never issued', async () => {
    const query = { code: 'c', shop: 'demo-store.myshopify.com', state: 'never-issued', timestamp: '1710000000' };
    const hmac = shopifyOauthHmac(query, 'shopify-test-secret');
    const response = await request(app.getHttpServer())
      .get('/api/shopify/callback')
      .query({ ...query, hmac })
      .expect(302);
    expect(response.headers.location).toContain('shopify=error');
    expect(await app.get<Model<OauthState>>(getModelToken(OauthState.name)).countDocuments()).toBe(0);
  });

  it('logs a Confirm tap on the TEST message and does not create an order', async () => {
    const secret = 'wa-app-secret-test';
    const users = app.get<Model<User>>(getModelToken(User.name));
    const orders = app.get<Model<Order>>(getModelToken(Order.name));
    const audits = app.get<Model<AuditEvent>>(getModelToken(AuditEvent.name));
    const user = await users.create({
      email: 'wa-test@shop.test',
      passwordHash: 'not-used',
      name: 'WA',
      shopName: 'WA Shop',
      whatsapp: {
        tokenEnvelope: null,
        tokenLast4: '',
        phoneNumberId: 'phone-test-1',
        wabaId: 'waba-1',
        appSecretEnvelope: seal(secret, process.env.KEY_ENCRYPTION_KEY || ''),
        appSecretLast4: 'test',
        templateName: 'order_confirmation_hinglish',
        templateStatus: 'APPROVED',
        templateLanguage: 'en',
      },
    });
    const raw = JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'phone-test-1' },
                messages: [
                  {
                    from: '919800000000',
                    id: 'wamid.IN',
                    type: 'button',
                    button: { text: 'Confirm', payload: 'Confirm' },
                    context: { id: 'wamid.TEST' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    const accepted = await request(app.getHttpServer())
      .post('/api/whatsapp/webhook')
      .set('x-hub-signature-256', metaSignature(raw, secret))
      .set('content-type', 'application/json')
      .send(raw)
      .expect(200);
    expect(accepted.body.ok).toBe(true);
    let logged = 0;
    for (let attempt = 0; attempt < 20 && !logged; attempt += 1) {
      logged = await audits.countDocuments({ sellerId: user._id, action: 'whatsapp.test_reply' });
      if (!logged) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(logged).toBe(1);
    const row = await audits.findOne({ sellerId: user._id, action: 'whatsapp.test_reply' });
    expect(row?.meta).toMatchObject({ wamid: 'wamid.TEST', choice: 'confirmed', orderNo: 'TEST' });
    expect(await orders.countDocuments({ sellerId: user._id })).toBe(0);
    const stored = await inbox.findOne({ provider: 'whatsapp', shop: 'phone-test-1' });
    expect(stored?.status).toBe('done');
    expect(stored?.error || '').toBe('');
  });

  it('refuses an inbox drain without the shared secret', async () => {
    await request(app.getHttpServer()).post('/api/inbox/drain').expect(401);
    await request(app.getHttpServer()).post('/api/inbox/drain').set('x-inbox-secret', 'inbox-test-secret').expect(200);
  });
});
