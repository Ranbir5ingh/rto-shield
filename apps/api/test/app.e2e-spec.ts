import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { VaultService } from '../src/common/vault.service';
import { configureApp } from '../src/configure-app';
import { AuditEvent } from '../src/database/audit.schema';
import { Order } from '../src/database/order.schema';
import { User } from '../src/database/user.schema';
import { MlService } from '../src/ml/ml.service';

const fakeMl = {
  predict: jest.fn(async (
    history: Array<{ id: string }>,
    pending: Array<{ id: string; address?: string; pincode?: string }>,
    _options: { speed?: string; timeoutMs?: number } = {},
  ) => {
    expect(JSON.stringify({ history, pending })).not.toMatch(/phone|buyer_name|buyerName/);
    return {
      model: 'sklearn-gradient-boosting',
      model_label: 'Deterministic fallback (scikit-learn gradient boosting). TabPFN was not used.',
      metrics: { auc: 0.82, precision_at_top_10pct: 0.7, n_train: 40, n_test: 10, positive_rate_test: 0.3 },
      predictions: pending.map((row, index) => ({
        id: row.id,
        score: index === 0 ? 81 : 22,
        probability: index === 0 ? 0.81 : 0.22,
        band: index === 0 ? 'High' : 'Low',
        reasons: ['Cash on delivery from a first-time buyer'],
        address_quality: {
          quality_score: 0.4,
          incomplete: true,
          landmark_only: false,
          junk: false,
          pincode_mismatch: false,
          notes: 'incomplete',
          source: 'heuristic',
        },
        model: 'sklearn-gradient-boosting',
      })),
      warnings: ['Address quality used local rules.'],
      address_source: 'heuristic',
      feature_columns: ['is_cod'],
    };
  }),
  messages: jest.fn(async () => ({ source: 'template', warnings: [], messages: [] })),
  health: jest.fn(async () => ({
    ok: true,
    tabpfn_token: false,
    tabpfn_client_installed: false,
    tabpfn_local_installed: false,
    gemini: false,
    ollama_configured: false,
    sentry: false,
    active_predictor: 'sklearn-gradient-boosting',
  })),
};

describe('RTO Shield API', () => {
  let app: INestApplication;
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongo.getUri();
    process.env.MONGODB_MODE = 'memory';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MlService)
      .useValue(fakeMl)
      .compile();
    app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongo.stop();
  });

  async function csrf(agent: ReturnType<typeof request.agent>) {
    const response = await agent.get('/api/auth/csrf').expect(200);
    return response.body.csrfToken as string;
  }

  it('reports shallow and deep health without a session', async () => {
    const health = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(health.body.ok).toBe(true);
    const deep = await request(app.getHttpServer()).get('/api/health/deep').expect(200);
    expect(deep.body.ok).toBe(true);
    expect(deep.body.ml.ok).toBe(true);
    expect(JSON.stringify(deep.body)).not.toMatch(/token|phone|address/i);
    const ml = await request(app.getHttpServer()).get('/api/health/ml').expect(200);
    expect(ml.body).toEqual({ ok: true });
  });

  it('requires csrf, then signs up and reads the session', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/signup').send({
      email: 'a@shop.test',
      password: 'supersecret',
      name: 'Asha',
      shopName: 'Asha Studio',
    }).expect(403);
    const token = await csrf(agent);
    const created = await agent
      .post('/api/auth/signup')
      .set('x-csrf-token', token)
      .send({ email: 'asha@shop.test', password: 'short', name: 'Asha', shopName: 'Asha Studio' })
      .expect(400);
    expect(created.body.error).toBe('Invalid input');
    const ok = await agent
      .post('/api/auth/signup')
      .set('x-csrf-token', token)
      .send({ email: 'asha@shop.test', password: 'supersecret', name: 'Asha', shopName: 'Asha Studio' })
      .expect(201);
    expect(ok.body.user.email).toBe('asha@shop.test');
    expect(ok.body.user.passwordHash).toBeUndefined();
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.shopName).toBe('Asha Studio');
  });

  it('isolates sellers and masks phones', async () => {
    const asha = request.agent(app.getHttpServer());
    const tokenA = await csrf(asha);
    const loggedIn = await asha
      .post('/api/auth/login')
      .set('x-csrf-token', tokenA)
      .send({ email: 'asha@shop.test', password: 'supersecret' })
      .expect(201);
    const freshA = loggedIn.body.csrfToken as string;

    const order = await asha
      .post('/api/orders/manual')
      .set('x-csrf-token', freshA)
      .send({
        buyerName: '=cmd|calc',
        phone: '9876543210',
        address: 'H.No 12, Lane 4',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400058',
        orderValue: 899,
        paymentType: 'cod',
      })
      .expect(201);
    expect(order.body.phoneMasked).toBe('98*****210');
    expect(order.body.phone).toBeUndefined();
    expect(order.body.address).toContain('Lane 4');

    const list = await asha.get('/api/orders?stage=pending').expect(200);
    expect(list.body.orders[0].phoneMasked).toContain('*');
    expect(JSON.stringify(list.body)).not.toContain('9876543210');
    expect(list.body.orders[0].address).toBeUndefined();

    const other = request.agent(app.getHttpServer());
    const tokenB = await csrf(other);
    await other
      .post('/api/auth/signup')
      .set('x-csrf-token', tokenB)
      .send({ email: 'b@shop.test', password: 'supersecret', name: 'Bela', shopName: 'Bela Shop' })
      .expect(201);
    await other.get(`/api/orders/${order.body.id}`).expect(404);
    const foreign = await other.get('/api/orders').expect(200);
    expect(foreign.body.total).toBe(0);
  });

  it('imports a shopify-style history row', async () => {
    const agent = request.agent(app.getHttpServer());
    const token = await csrf(agent);
    const session = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', token)
      .send({ email: 'asha@shop.test', password: 'supersecret' })
      .expect(201);
    const csrfToken = session.body.csrfToken as string;
    const csv = [
      'Name,Shipping Name,Shipping Address1,Shipping City,Shipping Zip,Shipping Province,Shipping Phone,Payment Method,Created at,Total,Fulfillment Status',
      '#1001,Aarav Sharma,"H.No 12, Lane 4",Mumbai,400058,Maharashtra,9000000001,Cash on Delivery (COD),2026-09-01 14:22:00 +0530,899,fulfilled',
    ].join('\n');
    const preview = await agent.post('/api/orders/preview').set('x-csrf-token', csrfToken).send({ csv }).expect(201);
    expect(preview.body.preset).toBe('shopify');
    const imported = await agent
      .post('/api/orders/import')
      .set('x-csrf-token', csrfToken)
      .send({ mode: 'history', csv, mapping: preview.body.suggestedMapping, source: 'shopify' })
      .expect(201);
    expect(imported.body.inserted).toBe(1);
  });

  it('scores sample orders, confirms the queue, and exports safely', async () => {
    const agent = request.agent(app.getHttpServer());
    const token = await csrf(agent);
    const session = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', token)
      .send({ email: 'asha@shop.test', password: 'supersecret' })
      .expect(201);
    let csrfToken = session.body.csrfToken as string;
    const sample = await agent.post('/api/orders/sample').set('x-csrf-token', csrfToken).expect(201);
    expect(sample.body.history).toBe(360);
    expect(sample.body.pending).toBe(24);
    csrfToken = session.body.csrfToken as string;
    const scored = await agent.post('/api/orders/score').set('x-csrf-token', csrfToken).expect(201);
    expect(scored.body.model).toBe('sklearn-gradient-boosting');
    expect(scored.body.metrics.auc).toBe(0.82);
    const queue = await agent.get('/api/queue').expect(200);
    expect(queue.body.orders.length).toBeGreaterThan(0);
    expect(queue.body.orders[0].waUrl).toContain('https://wa.me/91');
    const top = queue.body.orders[0];
    const updated = await agent
      .patch(`/api/orders/${top.id}/outcome`)
      .set('x-csrf-token', csrfToken)
      .send({ outcome: 'cancelled' })
      .expect(200);
    expect(updated.body.stage).toBe('closed');
    const again = await agent
      .patch(`/api/orders/${top.id}/outcome`)
      .set('x-csrf-token', csrfToken)
      .send({ outcome: 'cancelled' })
      .expect(200);
    expect(again.body.outcome).toBe('cancelled');
    const dashboard = await agent.get('/api/dashboard').expect(200);
    expect(dashboard.body.savedInr).toBeGreaterThan(0);
    expect(dashboard.body.exposureInr).toBeGreaterThanOrEqual(0);
    expect(dashboard.body.rtoRate).not.toBeNull();
    const pin = await agent.get('/api/pincode/560038').expect(200);
    expect(pin.body.fairness).toMatch(/never a ban/i);
    expect(pin.body.locality).toMatch(/Indiranagar/);
    delete process.env.ELEVENLABS_API_KEY;
    await agent.post('/api/elevenlabs/agent').expect(401);
    await agent.post('/api/elevenlabs/agent').set('x-inbox-secret', 'inbox-test-secret').expect(400);
    const voice = await agent.post(`/api/orders/${top.id}/voice`).set('x-csrf-token', csrfToken).expect(201);
    expect(voice.body.audioBase64).toBeNull();
    expect(voice.body.notice).toMatch(/ELEVENLABS_API_KEY/);
    const exported = await agent.get('/api/account/export').expect(200);
    expect(exported.text).toContain("'=cmd|calc");
    expect(exported.headers['content-type']).toMatch(/text\/csv/);
  });

  it('opens an isolated demo shop in one request', async () => {
    const agent = request.agent(app.getHttpServer());
    const token = await csrf(agent);
    const opened = await agent.post('/api/auth/demo').set('x-csrf-token', token).expect(201);
    expect(opened.body.user.shopName).toBe('Asha Studio');
    expect(opened.body.user.email).toMatch(/@demo\.rtoshield\.tech$/);
    expect(opened.body.scored).toBe(true);
    const demoCall = fakeMl.predict.mock.calls.at(-1);
    expect(demoCall?.[2]).toEqual(expect.objectContaining({ speed: 'fast', timeoutMs: 1_200 }));
    expect(demoCall?.[0]).toHaveLength(40);
    const orders = await agent.get('/api/orders?stage=pending&limit=50').expect(200);
    expect(orders.body.orders.length).toBeGreaterThan(0);
    expect(orders.body.orders.every((order: { riskScore: number | null; riskBand: string | null }) => order.riskScore !== null && order.riskBand)).toBe(true);
    const done = await agent.post('/api/tours/complete').set('x-csrf-token', opened.body.csrfToken).send({ tour: 'demo' }).expect(201);
    expect(done.body.ok).toBe(true);
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.role).toBe('owner');
    expect(me.body.user.isDemo).toBe(true);
    expect(me.body.user.tour.demoSeen).toBe(true);

    const dashboard = await agent.get('/api/dashboard').expect(200);
    expect(dashboard.body.model).toBeTruthy();
    expect(dashboard.body.impact.preventedInr).toBeGreaterThan(0);
    expect(dashboard.body.impact.conversions).toBeGreaterThan(0);
    const activity = await agent.get('/api/activity').expect(200);
    const convertedIds = new Set(
      (activity.body.events as Array<{ step: string; orderId: string }>)
        .filter((event) => event.step === 'converted')
        .map((event) => event.orderId),
    );
    expect(convertedIds.size).toBe(dashboard.body.impact.conversions);
    expect(dashboard.body.distribution.High + dashboard.body.distribution.Medium + dashboard.body.distribution.Low).toBeGreaterThan(0);
    expect(dashboard.body.liveWire.length).toBeGreaterThan(0);
    expect(orders.body.total).toBeGreaterThan(20);
    const stranger = request.agent(app.getHttpServer());
    const strangerToken = await csrf(stranger);
    await stranger
      .post('/api/auth/signup')
      .set('x-csrf-token', strangerToken)
      .send({ email: 'other@shop.test', password: 'supersecret', name: 'Other', shopName: 'Other Shop' })
      .expect(201);
    const theirs = await stranger.get('/api/orders?limit=5').expect(200);
    expect(theirs.body.total).toBe(0);
  });

  it('still opens a scored demo shop when the model service is down', async () => {
    fakeMl.predict.mockRejectedValueOnce(new Error('cold'));
    const agent = request.agent(app.getHttpServer());
    const token = await csrf(agent);
    const opened = await agent.post('/api/auth/demo').set('x-csrf-token', token).expect(201);
    expect(opened.body.scored).toBe(true);
    const orders = await agent.get('/api/orders?stage=pending&limit=50').expect(200);
    const closed = await agent.get('/api/orders?stage=closed&limit=50').expect(200);
    expect(orders.body.total + closed.body.total).toBe(24);
    expect(orders.body.orders.length).toBeGreaterThan(0);
    expect(
      orders.body.orders.every(
        (order: { riskScore: number | null; riskBand: string | null }) =>
          typeof order.riskScore === 'number' && ['Low', 'Medium', 'High'].includes(order.riskBand || ''),
      ),
    ).toBe(true);
    const dashboard = await agent.get('/api/dashboard').expect(200);
    // Opening fell back to rules. The background pass may already have replaced it if the service answers on the retry.
    expect(['rules-prior', 'sklearn-gradient-boosting']).toContain(dashboard.body.model.model);
    expect(Array.isArray(dashboard.body.liveWire)).toBe(true);
    expect(dashboard.body.liveWire.length).toBeGreaterThan(0);
    const queue = await agent.get('/api/queue').expect(200);
    expect(queue.body.orders.length).toBeGreaterThan(0);
  });

  it('reveals a saved secret only with the password, and then rate limits', async () => {
    const agent = request.agent(app.getHttpServer());
    const token = await csrf(agent);
    const email = 'secrets@shop.test';
    const password = 'supersecret';
    const accessToken = 'EAAGtesttokenvalue123456a1B2';
    const appSecret = 'app-secret-value-ZZ99';
    const created = await agent
      .post('/api/auth/signup')
      .set('x-csrf-token', token)
      .send({ email, password, name: 'Secret', shopName: 'Secret Shop' })
      .expect(201);
    const session = created.body.csrfToken as string;

    const users = app.get<Model<User>>(getModelToken(User.name));
    const vault = app.get(VaultService);
    const geminiKey = 'AIzaSyTestKeyValue1234567890';
    await users.updateOne(
      { email },
      { $set: { gemini: { keyEnvelope: vault.seal(geminiKey), last4: '7890', validatedAt: new Date().toISOString() } } },
    );
    const blank = await agent.post('/api/gemini').set('x-csrf-token', session).send({ apiKey: '' }).expect(201);
    expect(blank.body.last4).toBe('7890');
    expect(blank.body.configured).toBe(true);

    await agent
      .post('/api/whatsapp')
      .set('x-csrf-token', session)
      .send({ accessToken, phoneNumberId: '123456789012345', wabaId: '223456789012345', appSecret })
      .expect(201);
    const kept = await agent
      .post('/api/whatsapp')
      .set('x-csrf-token', session)
      .send({ accessToken: '', phoneNumberId: '123456789012345', wabaId: '223456789012345', appSecret: '' })
      .expect(201);
    expect(kept.body.tokenLast4).toBe('a1B2');
    expect(kept.body.appSecretLast4).toBe('ZZ99');

    const revealed = await agent
      .post('/api/settings/secrets/reveal')
      .set('x-csrf-token', session)
      .send({ field: 'whatsappToken', password })
      .expect(200);
    expect(revealed.body).toEqual({ value: accessToken });
    expect(String(revealed.headers['cache-control'])).toContain('no-store');

    await agent.post('/api/settings/secrets/reveal').send({ field: 'whatsappToken', password }).expect(403);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const denied = await agent
        .post('/api/settings/secrets/reveal')
        .set('x-csrf-token', session)
        .send({ field: 'whatsappToken', password: 'wrong-password' })
        .expect(401);
      expect(denied.body.error).toBe('Password did not match');
      expect(JSON.stringify(denied.body)).not.toContain(accessToken);
    }
    await agent
      .post('/api/settings/secrets/reveal')
      .set('x-csrf-token', session)
      .send({ field: 'whatsappToken', password })
      .expect(429);

    const audits = app.get<Model<AuditEvent>>(getModelToken(AuditEvent.name));
    const rows = await audits.find({ action: { $in: ['secret.reveal', 'secret.reveal_denied'] } }).lean();
    const dumped = JSON.stringify(rows);
    expect(dumped).toContain('whatsappToken');
    expect(dumped).not.toContain(accessToken);
    expect(dumped).not.toContain(appSecret);
    expect(dumped).not.toContain(geminiKey);
    expect(dumped).not.toContain(password);
  });

  it('checks the WhatsApp connection in plain language and records a webhook verify', async () => {
    const agent = request.agent(app.getHttpServer());
    const token = await csrf(agent);
    const created = await agent
      .post('/api/auth/signup')
      .set('x-csrf-token', token)
      .send({ email: 'wa-guide@shop.test', password: 'supersecret', name: 'Asha', shopName: 'Asha Studio' })
      .expect(201);
    const session = created.body.csrfToken as string;
    const status = await agent.get('/api/whatsapp').expect(200);
    expect(status.body.verifyToken).toBe('whatsapp-verify-test');
    expect(status.body.webhookVerified).toBe(false);
    expect(String(status.headers['cache-control'])).toContain('no-store');

    const early = await agent.post('/api/whatsapp/test-connection').set('x-csrf-token', session).expect(200);
    expect(early.body.ok).toBe(false);
    expect(early.body.checks.find((check: { id: string }) => check.id === 'webhook').ok).toBe(false);
    expect(early.body.checks.find((check: { id: string }) => check.id === 'token').hint).toMatch(/whatsapp_business_messaging/);
    expect(JSON.stringify(early.body)).not.toContain('whatsapp-verify-test');

    await request(app.getHttpServer())
      .get('/api/whatsapp/webhook')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '999' })
      .expect(403);
    const still = await agent.post('/api/whatsapp/test-connection').set('x-csrf-token', session).expect(200);
    expect(still.body.checks.find((check: { id: string }) => check.id === 'webhook').ok).toBe(false);

    const verified = await request(app.getHttpServer())
      .get('/api/whatsapp/webhook')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'whatsapp-verify-test', 'hub.challenge': '123' })
      .expect(200);
    expect(verified.text).toBe('123');

    const accessToken = 'EAAGtesttokenvalue123456a1B2';
    const appSecret = 'app-secret-value-ZZ99';
    await agent
      .post('/api/whatsapp')
      .set('x-csrf-token', session)
      .send({ accessToken, phoneNumberId: '123456789012345', wabaId: '223456789012345', appSecret })
      .expect(201);

    const original = global.fetch;
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.includes('graph.facebook.com')) return original(input, init);
      if (url.includes('message_templates')) {
        return new Response(
          JSON.stringify({ data: [{ name: 'order_confirmation_hinglish', language: 'en', status: 'APPROVED' }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.includes('223456789012345')) {
        return new Response(JSON.stringify({ id: '223456789012345', name: 'Asha Studio' }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ id: '123456789012345', display_phone_number: '919800001111', verified_name: 'Asha' }),
        { status: 200 },
      );
    }) as typeof fetch;

    try {
      const ready = await agent.post('/api/whatsapp/test-connection').set('x-csrf-token', session).expect(200);
      expect(ready.body.ok).toBe(true);
      const dumped = JSON.stringify(ready.body);
      expect(dumped).not.toContain(accessToken);
      expect(dumped).not.toContain(appSecret);
      expect(dumped).not.toContain('whatsapp-verify-test');
      expect(dumped).not.toContain('919800001111');
      expect(ready.body.checks.every((check: { ok: boolean; hint: string }) => check.ok && check.hint)).toBe(true);
    } finally {
      global.fetch = original;
    }

    const users = app.get<Model<User>>(getModelToken(User.name));
    await users.updateOne({ email: 'wa-guide@shop.test' }, { $set: { role: 'staff' } });
    const hidden = await agent.get('/api/whatsapp').expect(200);
    expect(hidden.body.verifyToken).toBe('');
    await agent.post('/api/whatsapp/test-connection').set('x-csrf-token', session).expect(403);

    const audits = app.get<Model<AuditEvent>>(getModelToken(AuditEvent.name));
    const rows = await audits.find({ action: 'whatsapp.test_connection' }).lean();
    const auditDump = JSON.stringify(rows);
    expect(auditDump).not.toContain(accessToken);
    expect(auditDump).not.toContain('whatsapp-verify-test');
  });

  it('rejects a bad login with the same message', async () => {
    const agent = request.agent(app.getHttpServer());
    const token = await csrf(agent);
    const response = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', token)
      .send({ email: 'missing@shop.test', password: 'supersecret' })
      .expect(401);
    expect(response.body.error).toBe('Invalid email or password');
  });

  it('gives a judge a read-mostly demo of a connected shop and rewinds their decisions', async () => {
    const previousEmail = process.env.DEMO_ACCOUNT_EMAIL;
    const previousCap = process.env.DEMO_WHATSAPP_DAILY_CAP;
    const email = 'judge@shop.test';
    const password = 'supersecret';
    const accessToken = 'EAAGjudgetokenvalue123456c3D4';
    const appSecret = 'judge-app-secret-QQ77';
    const phoneNumberId = '15551230000';
    const wabaId = '15559870000';
    process.env.DEMO_WHATSAPP_DAILY_CAP = '1';
    try {
      const owner = request.agent(app.getHttpServer());
      const signupToken = await csrf(owner);
      const created = await owner
        .post('/api/auth/signup')
        .set('x-csrf-token', signupToken)
        .send({ email, password, name: 'Judge', shopName: 'Judge Shop' })
        .expect(201);
      const ownerCsrf = created.body.csrfToken as string;
      await owner.post('/api/orders/sample').set('x-csrf-token', ownerCsrf).expect(201);
      await owner.post('/api/orders/score').set('x-csrf-token', ownerCsrf).expect(201);
      const users = app.get<Model<User>>(getModelToken(User.name));
      const vault = app.get(VaultService);
      await users.updateOne(
        { email },
        {
          $set: {
            shopify: {
              shopDomain: 'rtoshield-dev-otqppsw4.myshopify.com',
              demo: false,
              scopes: 'read_orders,write_orders,read_fulfillments,read_customers',
              tokenEnvelope: vault.seal('shpat_judge_demo_token'),
              installedAt: new Date().toISOString(),
              uninstalledAt: null,
              backfill: { status: 'done', processed: 15, total: 15, error: null },
              riskTags: { high: 'rto-high', medium: 'rto-medium', low: 'rto-low' },
              rtoTag: 'RTO',
              autoCancelOnBuyerCancel: false,
            },
            whatsapp: {
              tokenEnvelope: vault.seal(accessToken),
              tokenLast4: 'c3D4',
              phoneNumberId,
              wabaId,
              appSecretEnvelope: vault.seal(appSecret),
              appSecretLast4: 'QQ77',
              templateName: 'order_confirmation',
              templateStatus: 'APPROVED',
              templateLanguage: 'en',
            },
            gemini: {
              keyEnvelope: vault.seal('AIzaSyJudgeKeyValue1234567890'),
              last4: '7890',
              validatedAt: new Date().toISOString(),
            },
          },
        },
      );
      const ownerWa = await owner.get('/api/whatsapp').expect(200);
      expect(ownerWa.body.tokenLast4).toBe('c3D4');
      expect(ownerWa.body.verifyToken).toBe('whatsapp-verify-test');

      const blocked = await owner.post('/api/orders/sample').set('x-csrf-token', ownerCsrf).expect(400);
      expect(blocked.body.error).toMatch(/connected to Shopify/);
      const queue = await owner.get('/api/queue').expect(200);
      const orderId = queue.body.orders[0].id as string;
      expect(orderId).toBeTruthy();

      process.env.DEMO_ACCOUNT_EMAIL = email;
      const visitor = request.agent(app.getHttpServer());
      const visitorCsrf = await csrf(visitor);
      const opened = await visitor.post('/api/demo/session').set('x-csrf-token', visitorCsrf).expect(201);
      expect(opened.body.user.role).toBe('demo');
      expect(opened.body.user.isDemo).toBe(false);
      expect(opened.body.user.officialDemo).toBe(true);
      expect(opened.body.demo).toBe(true);
      const demoCsrf = opened.body.csrfToken as string;

      const hidden = await visitor.get('/api/whatsapp').expect(200);
      const dumped = JSON.stringify(hidden.body);
      expect(hidden.body.configured).toBe(true);
      expect(hidden.body.tokenLast4).toBe('');
      expect(hidden.body.appSecretLast4).toBe('');
      expect(hidden.body.phoneNumberId).toBe('');
      expect(hidden.body.wabaId).toBe('');
      expect(hidden.body.verifyToken).toBe('');
      expect(dumped).not.toContain(accessToken);
      expect(dumped).not.toContain(appSecret);
      expect(dumped).not.toContain('c3D4');
      expect(dumped).not.toContain('QQ77');
      expect(dumped).not.toContain(phoneNumberId);
      expect(dumped).not.toContain(wabaId);
      expect(dumped).not.toContain('whatsapp-verify-test');
      expect(dumped).not.toContain('shpat_judge_demo_token');

      const template = await visitor.get('/api/whatsapp/template').expect(200);
      expect(JSON.stringify(template.body)).not.toContain(accessToken);
      expect(template.body.tokenLast4).toBe('');

      const gemini = await visitor.get('/api/gemini').expect(200);
      expect(gemini.body.last4).toBe('');
      expect(JSON.stringify(gemini.body)).not.toContain('AIzaSyJudgeKeyValue1234567890');
      const shop = await visitor.get('/api/shopify').expect(200);
      expect(JSON.stringify(shop.body)).not.toContain('shpat_judge_demo_token');

      const reveal = await visitor
        .post('/api/settings/secrets/reveal')
        .set('x-csrf-token', demoCsrf)
        .set('x-forwarded-for', '203.0.113.44')
        .send({ field: 'whatsappToken', password })
        .expect(403);
      expect(JSON.stringify(reveal.body)).not.toContain(accessToken);
      expect(JSON.stringify(reveal.body)).not.toContain(password);

      await visitor
        .patch('/api/account/settings')
        .set('x-csrf-token', demoCsrf)
        .send({ name: 'Nope', shopName: 'Nope', rtoCostInr: 10, messageLanguage: 'english' })
        .expect(403);
      await visitor.post('/api/shopify/install').set('x-csrf-token', demoCsrf).send({ shop: 'nope.myshopify.com' }).expect(403);
      await visitor.post('/api/shopify/settings').set('x-csrf-token', demoCsrf).send({ rtoTag: 'nope' }).expect(403);
      await visitor.post('/api/shopify/resync').set('x-csrf-token', demoCsrf).expect(403);
      await visitor.post('/api/elevenlabs').set('x-csrf-token', demoCsrf).send({ apiKey: 'sk_this_should_not_save_123456' }).expect(403);
      await visitor.delete('/api/elevenlabs').set('x-csrf-token', demoCsrf).expect(403);
      await visitor.post('/api/gemini').set('x-csrf-token', demoCsrf).send({ apiKey: 'AIzaSyShouldNotBeSaved000000' }).expect(403);
      await visitor.delete('/api/account/data').set('x-csrf-token', demoCsrf).send({ confirm: 'DELETE' }).expect(403);
      await visitor.delete('/api/account').set('x-csrf-token', demoCsrf).send({ confirm: 'DELETE', password }).expect(403);
      await visitor.get('/api/account/export').expect(403);
      await visitor.post('/api/orders/sample').set('x-csrf-token', demoCsrf).expect(403);
      await visitor.post('/api/tours/complete').set('x-csrf-token', demoCsrf).send({ tour: 'seller' }).expect(403);

      const sent = await visitor
        .post('/api/whatsapp/send')
        .set('x-csrf-token', demoCsrf)
        .send({ ids: [orderId] })
        .expect(201);
      expect(sent.body.notice).toBe('In the demo, messages go to our test phone');
      expect(sent.body.sent).toContain(orderId);
      expect(JSON.stringify(sent.body)).not.toContain(accessToken);
      await visitor.post('/api/whatsapp/send').set('x-csrf-token', demoCsrf).send({ ids: [orderId] }).expect(429);

      const decided = await visitor
        .patch(`/api/orders/${orderId}/outcome`)
        .set('x-csrf-token', demoCsrf)
        .send({ outcome: 'confirmed' })
        .expect(200);
      expect(decided.body.stage).toBe('closed');

      const rescored = await visitor.post('/api/orders/score').set('x-csrf-token', demoCsrf).expect(201);
      expect(typeof rescored.body.scored).toBe('number');

      await visitor.post('/api/tours/complete').set('x-csrf-token', demoCsrf).send({ tour: 'demo' }).expect(201);
      const me = await visitor.get('/api/auth/me').expect(200);
      expect(me.body.user.role).toBe('demo');
      expect(me.body.user.tour.demoSeen).toBe(true);

      const reset = await request(app.getHttpServer())
        .post('/api/demo/reset')
        .set('x-inbox-secret', 'inbox-test-secret')
        .expect(200);
      expect(reset.body.restored).toBeGreaterThan(0);
      const restored = await owner.get(`/api/orders/${orderId}`).expect(200);
      expect(restored.body.stage).toBe('pending');
      expect(restored.body.outcome).toBeNull();
      expect(restored.body.whatsappStatus == null || restored.body.whatsappStatus === '' || restored.body.whatsappStatus === 'failed').toBe(true);

      const stillOwner = await owner.get('/api/auth/me').expect(200);
      expect(stillOwner.body.user.role).toBe('owner');
      const stillSecret = await owner.get('/api/whatsapp').expect(200);
      expect(stillSecret.body.tokenLast4).toBe('c3D4');
      const userAfter = await users.findOne({ email }).lean();
      expect(userAfter?.shopify?.shopDomain).toBe('rtoshield-dev-otqppsw4.myshopify.com');
      expect(userAfter?.whatsapp?.tokenLast4).toBe('c3D4');
    } finally {
      if (previousEmail === undefined) delete process.env.DEMO_ACCOUNT_EMAIL;
      else process.env.DEMO_ACCOUNT_EMAIL = previousEmail;
      if (previousCap === undefined) delete process.env.DEMO_WHATSAPP_DAILY_CAP;
      else process.env.DEMO_WHATSAPP_DAILY_CAP = previousCap;
    }
  }, 30_000);

  it('purges one account and its shop data with the inbox secret', async () => {
    const agent = request.agent(app.getHttpServer());
    const token = await csrf(agent);
    const email = `purge-${Date.now()}@shop.test`;
    const created = await agent
      .post('/api/auth/signup')
      .set('x-csrf-token', token)
      .send({ email, password: 'supersecret', name: 'Purge', shopName: 'Purge Studio' })
      .expect(201);
    await agent.post('/api/orders/sample').set('x-csrf-token', created.body.csrfToken).expect(201);
    const users = app.get<Model<User>>(getModelToken(User.name));
    const orders = app.get<Model<Order>>(getModelToken(Order.name));
    const audits = app.get<Model<AuditEvent>>(getModelToken(AuditEvent.name));
    const before = await users.findOne({ email });
    expect(before).toBeTruthy();
    await orders.updateOne({ sellerId: before?._id }, { $set: { outcome: 'confirmed', callState: 'called', conversation: [{ at: new Date().toISOString(), direction: 'out', kind: 'template', text: 'Hi' }] } });

    await request(app.getHttpServer()).post('/api/admin/users/purge').send({ email }).expect(401);
    await request(app.getHttpServer()).post('/api/admin/users/purge').set('x-inbox-secret', 'wrong-secret').send({ email }).expect(401);
    await request(app.getHttpServer())
      .post('/api/admin/users/purge')
      .set('x-inbox-secret', 'inbox-test-secret')
      .send({ email: 'missing@shop.test' })
      .expect(404);

    const purged = await request(app.getHttpServer())
      .post('/api/admin/users/purge')
      .set('x-inbox-secret', 'inbox-test-secret')
      .send({ email: email.toUpperCase() })
      .expect(200);
    expect(purged.body.users).toBe(1);
    expect(purged.body.orders).toBeGreaterThan(0);
    expect(purged.body.decisions).toBeGreaterThan(0);
    expect(purged.body.messages).toBeGreaterThan(0);
    expect(purged.body.calls).toBeGreaterThan(0);
    expect(JSON.stringify(purged.body)).not.toContain(email);
    expect(JSON.stringify(purged.body)).not.toContain('supersecret');
    expect(await users.findOne({ email })).toBeNull();
    expect(await orders.countDocuments({ sellerId: before?._id })).toBe(0);
    const log = await audits.findOne({ action: 'admin.purge', sellerId: before?._id }).lean();
    expect(log?.meta.users).toBe(1);
    expect(JSON.stringify(log?.meta)).not.toContain(email);
    await agent.get('/api/auth/me').expect(401);
  });
});
