import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { metaSignature } from '@rto/vault';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { VaultService } from '../src/common/vault.service';
import { configureApp } from '../src/configure-app';
import { Order } from '../src/database/order.schema';
import { User } from '../src/database/user.schema';
import { MlService } from '../src/ml/ml.service';

const SHOP = 'rtoshield-dev-otqppsw4.myshopify.com';
const TOKEN = 'shpat_address_test';
const APP_SECRET = 'wa-address-secret';
const GEMINI = '{"street":"12, 4th Main Road","landmark":"near cafe","city":"Bengaluru","state":"Karnataka","pin":"560038"}';

type Recorded = { url: string; body: string; token: string };

describe('buyer address replies write Shopify', () => {
  let app: INestApplication;
  let mongo: MongoMemoryServer;
  const originalFetch = global.fetch;
  let calls: Recorded[] = [];

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongo.getUri();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MlService)
      .useValue({
        predict: jest.fn(async () => ({ predictions: [], model: 'test', warnings: [] })),
        messages: jest.fn(async () => ({ source: 'template', warnings: [], messages: [] })),
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

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function installFetch() {
    calls = [];
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = typeof init?.body === 'string' ? init.body : '';
      const headers = init?.headers;
      const token =
        headers && !(headers instanceof Headers) && !Array.isArray(headers)
          ? String((headers as Record<string, string>)['x-shopify-access-token'] || '')
          : '';
      calls.push({ url, body, token });
      if (url.includes('generativelanguage.googleapis.com')) {
        return Response.json({ candidates: [{ content: { parts: [{ text: GEMINI }] } }] });
      }
      if (url.includes('api.postalpincode.in/pincode/560038')) {
        return Response.json([
          {
            Status: 'Success',
            PostOffice: [{ Name: 'Indiranagar', District: 'Bengaluru', State: 'Karnataka', Block: 'Bangalore North', Division: 'Bengaluru East' }],
          },
        ]);
      }
      if (url.includes('api.postalpincode.in')) return Response.json([{ Status: 'Error', PostOffice: null }]);
      if (url.includes('/graphql.json')) {
        const parsed = JSON.parse(body) as {
          query?: string;
          variables?: { input?: { id?: string; shippingAddress?: Record<string, string> }; id?: string; tags?: string[] };
        };
        const query = parsed.query || '';
        const id = parsed.variables?.input?.id || '';
        if (query.includes('orderUpdate') && id.endsWith('/bad')) {
          return Response.json({
            data: { orderUpdate: { userErrors: [{ field: ['shippingAddress', 'zip'], message: 'Access denied for write_orders scope.' }] } },
          });
        }
        if (query.includes('orderUpdate') && id.endsWith('/top')) {
          return Response.json({ errors: [{ message: 'Throttled' }], data: null });
        }
        if (query.includes('orderUpdate')) return Response.json({ data: { orderUpdate: { userErrors: [] } } });
        if (query.includes('tagsAdd')) return Response.json({ data: { tagsAdd: { userErrors: [] } } });
        if (query.includes('tag:rto-test')) {
          return Response.json({
            data: { orders: { edges: [{ node: { id: 'gid://shopify/Order/1', tags: ['rto-test'] } }] } },
          });
        }
        return Response.json({ data: {} });
      }
      if (url.includes('graph.facebook.com')) return Response.json({ messages: [{ id: 'wamid.out' }] });
      return originalFetch(input, init);
    }) as typeof fetch;
  }

  async function csrf(agent: ReturnType<typeof request.agent>) {
    const response = await agent.get('/api/auth/csrf').expect(200);
    return response.body.csrfToken as string;
  }

  async function openShop(email: string, phoneNumberId: string) {
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
          messageLanguage: 'english',
          shopify: {
            shopDomain: SHOP,
            demo: false,
            scopes: 'read_orders,write_orders,read_fulfillments,read_customers',
            tokenEnvelope: vault.seal(TOKEN),
            installedAt: new Date().toISOString(),
            uninstalledAt: null,
            backfill: { status: 'done', processed: 1, total: 1, error: null },
            riskTags: { high: 'rto-high', medium: 'rto-medium', low: 'rto-low' },
            rtoTag: 'RTO',
            autoCancelOnBuyerCancel: false,
          },
          whatsapp: {
            tokenEnvelope: vault.seal('EAAG-address-token'),
            tokenLast4: 'oken',
            phoneNumberId,
            wabaId: 'waba-address',
            appSecretEnvelope: vault.seal(APP_SECRET),
            appSecretLast4: 'cret',
            templateName: 'order_confirmation',
            templateStatus: 'APPROVED',
            templateLanguage: 'en',
            flowStatus: {
              'address_updated_confirmation:en': 'APPROVED',
              'order_reminder:en': 'APPROVED',
            },
          },
          gemini: {
            keyEnvelope: vault.seal('AIzaSyAddressKeyValue1234567890'),
            last4: '7890',
            validatedAt: new Date().toISOString(),
          },
        },
      },
    );
    return { agent, csrfToken: created.body.csrfToken as string };
  }

  async function manual(agent: ReturnType<typeof request.agent>, csrfToken: string, phone: string, externalOrderId: string) {
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

  async function webhook(phoneNumberId: string, message: Record<string, unknown>) {
    const raw = JSON.stringify({
      entry: [{ changes: [{ value: { metadata: { phone_number_id: phoneNumberId }, messages: [message] } }] }],
    });
    await request(app.getHttpServer())
      .post('/api/whatsapp/webhook')
      .set('x-hub-signature-256', metaSignature(raw, APP_SECRET))
      .set('content-type', 'application/json')
      .send(raw)
      .expect(200);
  }

  async function settle(read: () => Promise<boolean>) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await request(app.getHttpServer()).post('/api/inbox/drain').set('x-inbox-secret', 'inbox-test-secret');
      if (await read()) return;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  }

  function orderUpdates() {
    return calls
      .filter((call) => call.url.includes('/graphql.json') && call.body.includes('orderUpdate'))
      .map((call) => JSON.parse(call.body) as { variables: { input: { id: string; shippingAddress: Record<string, string> } } });
  }

  it('parses a quoted reply, checks India Post, and writes countryCode plus provinceCode', async () => {
    installFetch();
    const phoneId = 'phone-quoted';
    const { agent, csrfToken } = await openShop('quoted@shop.test', phoneId);
    const orders = app.get<Model<Order>>(getModelToken(Order.name));
    const id = await manual(agent, csrfToken, '9800000001', 'Q-1001');
    await orders.updateOne(
      { _id: id },
      {
        $set: {
          shopifyGid: 'gid://shopify/Order/11',
          intervention: 'request_address',
          whatsappMessageId: 'wamid.addr.11',
          conversation: [{ at: new Date().toISOString(), direction: 'out', kind: 'template', text: 'address_update_request Q-1001' }],
        },
      },
    );
    await webhook(phoneId, {
      from: '919800000001',
      id: 'wamid.in.11',
      type: 'text',
      text: { body: '12 4th Main near cafe Bengaluru Karnataka 560038' },
      context: { id: 'wamid.addr.11' },
    });
    await settle(async () => Boolean((await orders.findById(id))?.addressFixedAt));
    const saved = await orders.findById(id);
    expect(saved?.pincode).toBe('560038');
    expect(saved?.city).toBe('Bengaluru');
    expect(saved?.state).toBe('Karnataka');
    expect(saved?.exception).toBeNull();
    expect(saved?.timeline.map((step) => step.detail).join(' ')).toMatch(/Address checked and saved from reply/);
    const update = orderUpdates().find((call) => call.variables.input.id === 'gid://shopify/Order/11');
    expect(update?.variables.input.shippingAddress).toEqual({
      address1: '12, 4th Main Road',
      address2: 'near cafe',
      city: 'Bengaluru',
      zip: '560038',
      countryCode: 'IN',
      provinceCode: 'KA',
    });
    expect(calls.some((call) => call.url === `https://${SHOP}/admin/api/2026-10/graphql.json` && call.token === TOKEN)).toBe(true);
    expect(calls.some((call) => call.body.includes('rto-address-fixed') && call.body.includes('gid://shopify/Order/11'))).toBe(true);
    expect(calls.some((call) => call.url.includes('generativelanguage.googleapis.com'))).toBe(true);
    expect(calls.some((call) => call.url.includes('postalpincode.in/pincode/560038'))).toBe(true);
    expect(calls.some((call) => call.body.includes('address_updated_confirmation'))).toBe(true);
    const activity = await agent.get('/api/activity').expect(200);
    const addressEvent = (activity.body.events as Array<{ step: string; detail: string; externalOrderId: string }>).find(
      (event) => event.externalOrderId === 'Q-1001' && event.step === 'address',
    );
    expect(addressEvent?.detail).toMatch(/saved from reply/);
  });

  it('matches a plain reply to the latest open address request for that phone', async () => {
    installFetch();
    const phoneId = 'phone-plain';
    const { agent, csrfToken } = await openShop('plain@shop.test', phoneId);
    const orders = app.get<Model<Order>>(getModelToken(Order.name));
    const latestId = await manual(agent, csrfToken, '9800000002', 'P-NEW');
    const olderId = await manual(agent, csrfToken, '9800000002', 'P-OLD');
    const staleId = await manual(agent, csrfToken, '9800000003', 'P-STALE');
    const now = Date.now();
    await orders.updateOne(
      { _id: latestId },
      {
        $set: {
          shopifyGid: 'gid://shopify/Order/21',
          intervention: 'request_address',
          conversation: [{ at: new Date(now - 10 * 60 * 1000).toISOString(), direction: 'out', kind: 'template', text: 'address_update_request P-NEW' }],
        },
      },
    );
    await orders.updateOne(
      { _id: olderId },
      {
        $set: {
          shopifyGid: 'gid://shopify/Order/22',
          intervention: 'request_address',
          conversation: [{ at: new Date(now - 3 * 60 * 60 * 1000).toISOString(), direction: 'out', kind: 'template', text: 'address_update_request P-OLD' }],
        },
      },
    );
    await orders.updateOne(
      { _id: staleId },
      {
        $set: {
          shopifyGid: 'gid://shopify/Order/23',
          intervention: 'request_address',
          conversation: [{ at: new Date(now - 30 * 60 * 60 * 1000).toISOString(), direction: 'out', kind: 'template', text: 'address_update_request P-STALE' }],
        },
      },
    );
    await webhook(phoneId, {
      from: '919800000002',
      id: 'wamid.in.21',
      type: 'text',
      text: { body: '12 4th Main near cafe Bengaluru Karnataka 560038' },
    });
    await webhook(phoneId, {
      from: '919800000003',
      id: 'wamid.in.23',
      type: 'text',
      text: { body: '12 4th Main near cafe Bengaluru Karnataka 560038' },
    });
    await settle(async () => (await orders.findById(latestId))?.pincode === '560038');
    expect((await orders.findById(latestId))?.city).toBe('Bengaluru');
    expect((await orders.findById(olderId))?.pincode).toBe('400001');
    expect((await orders.findById(staleId))?.pincode).toBe('400001');
    const ids = orderUpdates().map((call) => call.variables.input.id);
    expect(ids).toContain('gid://shopify/Order/21');
    expect(ids).not.toContain('gid://shopify/Order/22');
    expect(ids).not.toContain('gid://shopify/Order/23');
  });

  it('does not log saved or send the address update when Shopify rejects the write', async () => {
    installFetch();
    const phoneId = 'phone-fail';
    const { agent, csrfToken } = await openShop('fail@shop.test', phoneId);
    const orders = app.get<Model<Order>>(getModelToken(Order.name));
    const deniedId = await manual(agent, csrfToken, '9800000004', 'F-SCOPE');
    const throttledId = await manual(agent, csrfToken, '9800000005', 'F-BUSY');
    const stamp = [{ at: new Date().toISOString(), direction: 'out', kind: 'template', text: 'address_update_request order' }];
    await orders.updateOne(
      { _id: deniedId },
      { $set: { shopifyGid: 'gid://shopify/Order/bad', intervention: 'request_address', whatsappMessageId: 'wamid.bad', conversation: stamp } },
    );
    await orders.updateOne(
      { _id: throttledId },
      { $set: { shopifyGid: 'gid://shopify/Order/top', intervention: 'request_address', whatsappMessageId: 'wamid.top', conversation: stamp } },
    );
    await webhook(phoneId, {
      from: '919800000004',
      id: 'wamid.in.bad',
      type: 'text',
      text: { body: '12 4th Main near cafe Bengaluru Karnataka 560038' },
      context: { id: 'wamid.bad' },
    });
    await webhook(phoneId, {
      from: '919800000005',
      id: 'wamid.in.top',
      type: 'text',
      text: { body: '12 4th Main near cafe Bengaluru Karnataka 560038' },
      context: { id: 'wamid.top' },
    });
    await settle(async () => (await orders.findById(deniedId))?.exception === 'shopify' && (await orders.findById(throttledId))?.exception === 'shopify');
    const denied = await orders.findById(deniedId);
    const throttled = await orders.findById(throttledId);
    expect(denied?.addressFixedAt).toBeNull();
    expect(denied?.exceptionWhy).toMatch(/Shopify write failed/);
    expect(denied?.exceptionWhy).toMatch(/write_orders/);
    expect(denied?.timeline.map((step) => step.detail).join(' ')).not.toMatch(/saved/i);
    expect(throttled?.addressFixedAt).toBeNull();
    expect(throttled?.exceptionWhy).toMatch(/Shopify write failed/);
    expect(throttled?.exceptionWhy).toMatch(/busy/i);
    expect(throttled?.timeline.map((step) => step.detail).join(' ')).not.toMatch(/saved/i);
    expect(calls.some((call) => call.body.includes('address_updated_confirmation'))).toBe(false);
    expect(calls.some((call) => call.body.includes('rto-address-fixed'))).toBe(false);
    const activity = await agent.get('/api/activity').expect(200);
    const details = (activity.body.events as Array<{ detail: string }>).map((event) => event.detail).join(' ');
    expect(details).toMatch(/Shopify write failed/);
    expect(details).not.toMatch(/saved/i);
  });

  it('writes only rto-test dev-store orders through Shopify and sends no WhatsApp', async () => {
    installFetch();
    const agent = request.agent(app.getHttpServer());
    const signupToken = await csrf(agent);
    await agent
      .post('/api/auth/signup')
      .set('x-csrf-token', signupToken)
      .send({ email: 'dev-demo@shop.test', password: 'supersecret', name: 'Demo', shopName: 'Dev Demo' })
      .expect(201);
    const users = app.get<Model<User>>(getModelToken(User.name));
    const orders = app.get<Model<Order>>(getModelToken(Order.name));
    const vault = app.get(VaultService);
    const owner = await users.findOne({ email: 'dev-demo@shop.test' });
    owner!.shopify = {
      shopDomain: SHOP,
      demo: true,
      scopes: 'read_orders,write_orders,read_fulfillments,read_customers',
      tokenEnvelope: vault.seal(TOKEN),
      installedAt: new Date().toISOString(),
      uninstalledAt: null,
      backfill: { status: 'done', processed: 5, total: 5, error: null },
      riskTags: { high: 'rto-high', medium: 'rto-medium', low: 'rto-low' },
      rtoTag: 'RTO',
      autoCancelOnBuyerCancel: false,
    };
    await owner!.save();
    const base = {
      sellerId: owner!._id,
      buyerNameEnc: 'enc',
      phoneEnc: 'enc',
      phoneMasked: '98••••01',
      addressEnc: 'enc',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
      orderValue: 800,
      paymentType: 'cod' as const,
      orderedAt: new Date(),
      hour: 10,
      stage: 'pending' as const,
      outcome: null,
      source: 'shopify' as const,
    };
    await orders.create({ ...base, externalOrderId: 'a0', shopifyGid: 'gid://shopify/Order/1' });
    await orders.create({ ...base, externalOrderId: 'a1', shopifyGid: 'gid://shopify/Order/2' });
    await orders.create({ ...base, externalOrderId: 'a2', shopifyGid: 'gid://shopify/Order/3' });
    await orders.create({ ...base, externalOrderId: 'a3', shopifyGid: 'gid://shopify/Order/4' });
    await orders.create({ ...base, externalOrderId: 'a4', shopifyGid: 'gid://shopify/Order/5' });
    await agent.get('/api/dashboard').expect(200);
    const fixed = await orders.findOne({ externalOrderId: 'a0' });
    const untouched = await orders.findOne({ externalOrderId: 'a4' });
    expect(fixed?.pincode).toBe('560038');
    expect(fixed?.city).toBe('Bengaluru');
    expect(fixed?.state).toBe('Karnataka');
    expect(fixed?.addressFixedAt).toBeTruthy();
    expect(fixed?.timeline.map((step) => step.detail).join(' ')).toMatch(/India Post/);
    expect(untouched?.pincode).toBe('302001');
    expect(untouched?.addressFixedAt).toBeNull();
    const updates = orderUpdates();
    expect(updates.map((call) => call.variables.input.id)).toEqual(['gid://shopify/Order/1']);
    expect(updates[0]?.variables.input.shippingAddress.provinceCode).toBe('KA');
    expect(updates[0]?.variables.input.shippingAddress.countryCode).toBe('IN');
    expect(calls.some((call) => call.body.includes('rto-address-fixed') && call.body.includes('gid://shopify/Order/1'))).toBe(true);
    expect(calls.some((call) => /gid:\/\/shopify\/Order\/[2-5]/.test(call.body) && /orderUpdate|tagsAdd/.test(call.body))).toBe(false);
    expect(calls.some((call) => call.url.includes('graph.facebook.com') || call.url.includes('whatsapp'))).toBe(false);
  });
});
