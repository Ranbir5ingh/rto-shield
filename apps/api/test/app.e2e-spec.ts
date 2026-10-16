import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { MlService } from '../src/ml/ml.service';

const fakeMl = {
  predict: jest.fn(async (history: Array<{ id: string }>, pending: Array<{ id: string; address?: string; pincode?: string }>) => {
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
    const dashboard = await agent.get('/api/dashboard').expect(200);
    expect(dashboard.body.savedInr).toBeGreaterThan(0);
    expect(dashboard.body.rtoRate).not.toBeNull();
    const pin = await agent.get('/api/pincode/560038').expect(200);
    expect(pin.body.fairness).toMatch(/never a ban/i);
    expect(pin.body.locality).toMatch(/Indiranagar/);
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
    expect(demoCall?.[2]).toEqual(expect.objectContaining({ speed: 'fast', timeoutMs: 12_000 }));
    const orders = await agent.get('/api/orders?limit=5').expect(200);
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
});
