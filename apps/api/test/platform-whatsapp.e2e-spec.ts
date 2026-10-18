import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { metaSignature, seal } from '@rto/vault';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { Order } from '../src/database/order.schema';
import { User } from '../src/database/user.schema';
import { MlService } from '../src/ml/ml.service';

const PLATFORM = {
  token: 'EAAG-platform-token-value',
  phoneNumberId: '15550001111',
  wabaId: '15550002222',
  appSecret: 'platform-app-secret',
};

describe('platform WhatsApp', () => {
  let app: INestApplication;
  let mongo: MongoMemoryServer;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    process.env.WHATSAPP_PLATFORM_TOKEN = PLATFORM.token;
    process.env.WHATSAPP_PLATFORM_PHONE_NUMBER_ID = PLATFORM.phoneNumberId;
    process.env.WHATSAPP_PLATFORM_WABA_ID = PLATFORM.wabaId;
    process.env.WHATSAPP_PLATFORM_APP_SECRET = PLATFORM.appSecret;
    mongo = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongo.getUri();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MlService)
      .useValue({ predict: jest.fn(), messages: jest.fn(), addressNotes: jest.fn(), health: jest.fn(async () => null) })
      .compile();
    app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    delete process.env.WHATSAPP_PLATFORM_TOKEN;
    delete process.env.WHATSAPP_PLATFORM_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_PLATFORM_WABA_ID;
    delete process.env.WHATSAPP_PLATFORM_APP_SECRET;
    global.fetch = originalFetch;
    await app.close();
    await mongo.stop();
  });

  async function csrf(agent: ReturnType<typeof request.agent>) {
    const response = await agent.get('/api/auth/csrf').expect(200);
    return response.body.csrfToken as string;
  }

  async function shop(email: string) {
    const agent = request.agent(app.getHttpServer());
    const token = await csrf(agent);
    const created = await agent
      .post('/api/auth/signup')
      .set('x-csrf-token', token)
      .send({ email, password: 'supersecret', name: 'Owner', shopName: email.split('@')[0] })
      .expect(201);
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

  async function postWebhook(phoneNumberId: string, secret: string, message: Record<string, unknown>) {
    const raw = JSON.stringify({
      entry: [{ changes: [{ value: { metadata: { phone_number_id: phoneNumberId }, messages: [message] } }] }],
    });
    await request(app.getHttpServer())
      .post('/api/whatsapp/webhook')
      .set('x-hub-signature-256', metaSignature(raw, secret))
      .set('content-type', 'application/json')
      .send(raw)
      .expect(200);
  }

  async function drainUntil(read: () => Promise<boolean>) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await request(app.getHttpServer()).post('/api/inbox/drain').set('x-inbox-secret', 'inbox-test-secret');
      if (await read()) return;
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  }

  it('routes a platform-number reply by message id and keeps another shop untouched', async () => {
    const orders = app.get<Model<Order>>(getModelToken(Order.name));
    const alpha = await shop('platform-a@shop.test');
    const beta = await shop('platform-b@shop.test');
    const alphaId = await manual(alpha.agent, alpha.csrfToken, '9800000101', 'A-1');
    const betaId = await manual(beta.agent, beta.csrfToken, '9800000102', 'B-1');
    await orders.updateOne({ _id: alphaId }, { $set: { whatsappMessageId: 'wamid.alpha' } });
    await orders.updateOne({ _id: betaId }, { $set: { whatsappMessageId: 'wamid.beta' } });

    await postWebhook(PLATFORM.phoneNumberId, PLATFORM.appSecret, {
      from: '919800000101',
      id: 'wamid.in.alpha',
      type: 'button',
      button: { text: 'Confirm', payload: 'Confirm' },
      context: { id: 'wamid.alpha' },
    });
    await drainUntil(async () => (await orders.findById(alphaId))?.outcome === 'confirmed');

    expect((await orders.findById(alphaId))?.outcome).toBe('confirmed');
    expect((await orders.findById(betaId))?.stage).toBe('pending');
    expect((await orders.findById(betaId))?.outcome).toBeNull();
  });

  it('keeps a shop webhook on that shop when the owner uses their own number', async () => {
    const orders = app.get<Model<Order>>(getModelToken(Order.name));
    const users = app.get<Model<User>>(getModelToken(User.name));
    const own = await shop('platform-own@shop.test');
    const other = await shop('platform-other@shop.test');
    const ownId = await manual(own.agent, own.csrfToken, '9800000103', 'OWN-1');
    const otherId = await manual(other.agent, other.csrfToken, '9800000104', 'OTHER-1');
    const secret = 'own-app-secret';
    await users.updateOne(
      { email: 'platform-own@shop.test' },
      {
        $set: {
          whatsapp: {
            tokenEnvelope: seal('EAAG-own-token-value', process.env.KEY_ENCRYPTION_KEY || ''),
            tokenLast4: 'alue',
            phoneNumberId: '16660003333',
            wabaId: '16660004444',
            appSecretEnvelope: seal(secret, process.env.KEY_ENCRYPTION_KEY || ''),
            appSecretLast4: 'cret',
            templateName: 'order_confirmation',
            templateStatus: 'APPROVED',
            templateLanguage: 'en',
            useOwnNumber: true,
          },
        },
      },
    );
    await orders.updateOne({ _id: ownId }, { $set: { whatsappMessageId: 'wamid.own' } });
    await orders.updateOne({ _id: otherId }, { $set: { whatsappMessageId: 'wamid.other' } });
    await postWebhook('16660003333', secret, {
      from: '919800000103',
      id: 'wamid.in.own',
      type: 'button',
      button: { text: 'Confirm', payload: 'Confirm' },
      context: { id: 'wamid.own' },
    });
    await drainUntil(async () => (await orders.findById(ownId))?.outcome === 'confirmed');
    expect((await orders.findById(ownId))?.outcome).toBe('confirmed');
    expect((await orders.findById(otherId))?.outcome).toBeNull();
  });

  it('sends from the platform number until the owner switches on their own', async () => {
    const calls: string[] = [];
    global.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('message_templates')) {
        return new Response(JSON.stringify({ data: [{ name: 'order_confirmation', language: 'en', status: 'APPROVED' }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.out' }] }), { status: 200 });
    }) as typeof fetch;
    try {
      const seller = await shop('platform-send@shop.test');
      const id = await manual(seller.agent, seller.csrfToken, '9800000105', 'SEND-1');
      const status = await seller.agent.get('/api/whatsapp').expect(200);
      expect(status.body.messaging).toBe('platform');
      expect(status.body.phoneNumberId).toBe('');
      expect(JSON.stringify(status.body)).not.toContain(PLATFORM.token);
      await seller.agent.post('/api/whatsapp/send').set('x-csrf-token', seller.csrfToken).send({ ids: [id] }).expect(201);
      expect(calls.some((url) => url.includes(`/${PLATFORM.phoneNumberId}/messages`))).toBe(true);

      await seller.agent
        .post('/api/whatsapp')
        .set('x-csrf-token', seller.csrfToken)
        .send({ accessToken: 'EAAG-seller-token-value', phoneNumberId: '17770005555', wabaId: '17770006666', appSecret: 'seller-secret' })
        .expect(201);
      const own = await seller.agent.get('/api/whatsapp').expect(200);
      expect(own.body.messaging).toBe('own');
      calls.length = 0;
      await seller.agent
        .post('/api/whatsapp')
        .set('x-csrf-token', seller.csrfToken)
        .send({ useOwnNumber: false })
        .expect(201);
      const back = await seller.agent.get('/api/whatsapp').expect(200);
      expect(back.body.messaging).toBe('platform');
      await seller.agent.post('/api/whatsapp/send').set('x-csrf-token', seller.csrfToken).send({ ids: [id] }).expect(201);
      expect(calls.some((url) => url.includes(`/${PLATFORM.phoneNumberId}/messages`))).toBe(true);
      expect(calls.some((url) => url.includes('/17770005555/messages'))).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
