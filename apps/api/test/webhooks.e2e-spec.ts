import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { shopifyOauthHmac } from '@rto/vault';
import { createHmac } from 'crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { InboxEvent } from '../src/database/inbox.schema';
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

  it('refuses an inbox drain without the shared secret', async () => {
    await request(app.getHttpServer()).post('/api/inbox/drain').expect(401);
    await request(app.getHttpServer()).post('/api/inbox/drain').set('x-inbox-secret', 'inbox-test-secret').expect(200);
  });
});
