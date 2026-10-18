import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { createHmac } from 'crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { VaultService } from '../src/common/vault.service';
import { configureApp } from '../src/configure-app';
import { Order } from '../src/database/order.schema';
import { User } from '../src/database/user.schema';
import { MlService } from '../src/ml/ml.service';
import { OrdersService } from '../src/orders/orders.service';

const TOKEN = 'shpat_webhook_rescore';

describe('webhook re-score does not message the shop', () => {
  let app: INestApplication;
  let mongo: MongoMemoryServer;
  const originalFetch = global.fetch;
  let messageUrls: string[] = [];
  const predict = jest.fn(async (_history: unknown, pending: Array<{ id: string }>) => ({
    model: 'test-model',
    model_label: 'test',
    metrics: null,
    predictions: pending.map((row) => ({
      id: row.id,
      score: 72,
      probability: 0.72,
      band: 'High' as const,
      reasons: ['Cash on delivery'],
      address_quality: {
        quality_score: 0.9,
        incomplete: false,
        landmark_only: false,
        junk: false,
        pincode_mismatch: false,
        notes: '',
        source: 'heuristic',
      },
      model: 'test-model',
    })),
    warnings: [],
    address_source: 'heuristic',
    feature_columns: [],
  }));

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongo.getUri();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MlService)
      .useValue({
        predict,
        messages: jest.fn(async () => ({ source: 'template', warnings: [], messages: [] })),
        addressNotes: jest.fn(async () => ({ source: 'heuristic', addresses: [] })),
        health: jest.fn(async () => ({ ok: true })),
      })
      .compile();
    app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await app.close();
    await mongo.stop();
  });

  beforeEach(() => {
    predict.mockClear();
    messageUrls = [];
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/messages')) messageUrls.push(url);
      if (url.includes('graph.facebook.com') && url.includes('message_templates')) {
        return Response.json({ data: [{ name: 'order_confirmation', language: 'en', status: 'APPROVED' }] });
      }
      if (url.includes('graph.facebook.com')) return Response.json({ messages: [{ id: 'wamid.should-not-send' }] });
      if (url.includes('/graphql.json')) {
        return Response.json({
          data: {
            tagsAdd: { userErrors: [] },
            tagsRemove: { userErrors: [] },
            orderUpdate: { userErrors: [] },
            draftOrderCreate: { draftOrder: { id: 'gid://shopify/DraftOrder/1', invoiceUrl: 'https://shop.example/invoice' }, userErrors: [] },
          },
        });
      }
      return originalFetch(input, init);
    }) as typeof fetch;
  });

  function signed(raw: string) {
    return createHmac('sha256', 'shopify-test-secret').update(raw).digest('base64');
  }

  async function csrf(agent: ReturnType<typeof request.agent>) {
    const response = await agent.get('/api/auth/csrf').expect(200);
    return response.body.csrfToken as string;
  }

  async function openShop(email: string, shop: string, demo = false) {
    const agent = request.agent(app.getHttpServer());
    const signupToken = await csrf(agent);
    const created = await agent
      .post('/api/auth/signup')
      .set('x-csrf-token', signupToken)
      .send({ email, password: 'supersecret', name: 'Asha', shopName: 'Asha Studio' })
      .expect(201);
    const vault = app.get(VaultService);
    await app.get<Model<User>>(getModelToken(User.name)).updateOne(
      { email },
      {
        $set: {
          isDemo: demo,
          messageLanguage: 'english',
          reduction: {
            autopilot: true,
            prepaidEnabled: false,
            discountPct: 5,
            minRisk: 60,
            escalationMinutes: 120,
            noReply: 'hold',
          },
          shopify: {
            shopDomain: shop,
            demo,
            scopes: 'read_orders,write_orders,read_fulfillments,read_customers',
            tokenEnvelope: vault.seal(TOKEN),
            installedAt: new Date().toISOString(),
            uninstalledAt: null,
            backfill: { status: 'done', processed: 3, total: 3, error: null },
            riskTags: { high: 'rto-high', medium: 'rto-medium', low: 'rto-low' },
            rtoTag: 'RTO',
            autoCancelOnBuyerCancel: false,
          },
          whatsapp: {
            tokenEnvelope: vault.seal('EAAG-webhook-token'),
            tokenLast4: 'oken',
            phoneNumberId: '15550001111',
            wabaId: '15550002222',
            appSecretEnvelope: vault.seal('app-secret'),
            appSecretLast4: 'cret',
            templateName: 'order_confirmation',
            templateStatus: 'APPROVED',
            templateLanguage: 'en',
            useOwnNumber: true,
            flowStatus: { 'order_confirmation:en': 'APPROVED' },
          },
        },
      },
    );
    return { agent, csrfToken: created.body.csrfToken as string, userId: created.body.user.id as string };
  }

  async function manual(agent: ReturnType<typeof request.agent>, csrfToken: string, externalOrderId: string, phone: string) {
    const created = await agent
      .post('/api/orders/manual')
      .set('x-csrf-token', csrfToken)
      .send({
        externalOrderId,
        buyerName: 'Asha',
        phone,
        address: 'Old lane',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        orderValue: 799,
        paymentType: 'cod',
      })
      .expect(201);
    return created.body.id as string;
  }

  async function postOrderUpdated(shop: string, body: Record<string, unknown>, webhookId: string) {
    const raw = JSON.stringify(body);
    await request(app.getHttpServer())
      .post('/api/shopify/webhooks')
      .set('x-shopify-hmac-sha256', signed(raw))
      .set('x-shopify-webhook-id', webhookId)
      .set('x-shopify-topic', 'orders/updated')
      .set('x-shopify-shop-domain', shop)
      .set('content-type', 'application/json')
      .send(raw)
      .expect(200);
  }

  async function scored(userId: string) {
    const orders = app.get(OrdersService);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (predict.mock.calls.length > 0 && !orders.isUpgrading(userId)) return;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    throw new Error('webhook score did not finish');
  }

  function orderBody(id: number, name: string, tags: string) {
    return {
      id,
      admin_graphql_api_id: `gid://shopify/Order/${id}`,
      name,
      tags,
      financial_status: 'pending',
      total_price: '799.00',
      created_at: '2026-10-01T00:00:00Z',
      payment_gateway_names: ['Cash on Delivery (COD)'],
      shipping_address: {
        address1: '12, 4th Main Road',
        city: 'Bengaluru',
        province: 'Karnataka',
        zip: '560038',
        name: 'Asha',
        phone: '9800000001',
      },
    };
  }

  it('scores only the address write-back and sends nothing', async () => {
    const shop = 'address-write.myshopify.com';
    const { agent, csrfToken, userId } = await openShop('address-write@shop.test', shop);
    const orders = app.get<Model<Order>>(getModelToken(Order.name));
    const fixedId = await manual(agent, csrfToken, '#1003', '9800001003');
    const holdId = await manual(agent, csrfToken, '#1001', '9800001001');
    const freshId = await manual(agent, csrfToken, '#1002', '9800001002');
    await orders.updateOne(
      { _id: fixedId },
      { $set: { shopifyGid: 'gid://shopify/Order/1003', addressFixedAt: new Date(), intervention: 'confirm' } },
    );
    await orders.updateOne(
      { _id: holdId },
      {
        $set: {
          shopifyGid: 'gid://shopify/Order/1001',
          intervention: 'hold_review',
          interventionWhy: 'Held for the seller.',
          timeline: [{ at: new Date().toISOString(), step: 'hold', detail: 'Held for the seller.' }],
        },
      },
    );
    await orders.updateOne({ _id: freshId }, { $set: { shopifyGid: 'gid://shopify/Order/1002' } });

    await postOrderUpdated(shop, orderBody(1003, '#1003', 'rto-test, rto-address-fixed'), 'wh-address-1003');
    await scored(userId);

    const pendingIds = predict.mock.calls.flatMap((call) => (call[1] as Array<{ id: string }>).map((row) => row.id));
    expect(pendingIds).toEqual([fixedId]);
    expect(messageUrls).toEqual([]);
    const fixed = await orders.findById(fixedId);
    const hold = await orders.findById(holdId);
    const fresh = await orders.findById(freshId);
    expect(fixed?.whatsappStatus).toBeNull();
    expect(fixed?.riskScore).toBe(72);
    expect(hold?.intervention).toBe('hold_review');
    expect(hold?.riskScore).toBeNull();
    expect(fresh?.intervention).toBeNull();
    expect(fresh?.whatsappStatus).toBeNull();
    expect(fresh?.riskScore).toBeNull();
  });

  it('does not auto-send a demo shop when the webhook is an rto-test update', async () => {
    const shop = 'demo-rto-test.myshopify.com';
    const { agent, csrfToken, userId } = await openShop('demo-rto@shop.test', shop, true);
    const orders = app.get<Model<Order>>(getModelToken(Order.name));
    const targetId = await manual(agent, csrfToken, '#2001', '9800002001');
    const otherId = await manual(agent, csrfToken, '#2002', '9800002002');
    await orders.updateOne({ _id: targetId }, { $set: { shopifyGid: 'gid://shopify/Order/2001' } });
    await orders.updateOne({ _id: otherId }, { $set: { shopifyGid: 'gid://shopify/Order/2002', intervention: 'hold_review' } });

    await postOrderUpdated(shop, orderBody(2001, '#2001', 'rto-test'), 'wh-demo-2001');
    await scored(userId);

    const pendingIds = predict.mock.calls.flatMap((call) => (call[1] as Array<{ id: string }>).map((row) => row.id));
    expect(pendingIds).toEqual([targetId]);
    expect(messageUrls).toEqual([]);
    const other = await orders.findById(otherId);
    expect(other?.intervention).toBe('hold_review');
    expect(other?.riskScore).toBeNull();
    expect((await orders.findById(targetId))?.whatsappStatus).toBeNull();
  });

  it('sends a new order once and ignores the next webhook for that order', async () => {
    const shop = 'once-only.myshopify.com';
    const { agent, csrfToken, userId } = await openShop('once-only@shop.test', shop);
    const orders = app.get<Model<Order>>(getModelToken(Order.name));
    const id = await manual(agent, csrfToken, '#3001', '9800003001');
    await orders.updateOne({ _id: id }, { $set: { shopifyGid: 'gid://shopify/Order/3001' } });

    await postOrderUpdated(shop, orderBody(3001, '#3001', ''), 'wh-once-3001');
    await scored(userId);
    expect(messageUrls).toHaveLength(1);
    expect((await orders.findById(id))?.whatsappStatus).toBe('sent');

    predict.mockClear();
    await postOrderUpdated(shop, orderBody(3001, '#3001', ''), 'wh-once-3001-again');
    await scored(userId);
    expect(messageUrls).toHaveLength(1);
    expect(predict.mock.calls.flatMap((call) => (call[1] as Array<{ id: string }>).map((row) => row.id))).toEqual([id]);
  });
});
