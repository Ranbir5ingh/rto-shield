import { BadRequestException, ForbiddenException, HttpException } from '@nestjs/common';
import { OrdersService } from './orders.service';

const ORDER_ID = '64b000000000000000000001';

function seller() {
  return {
    _id: 'seller-1',
    role: 'owner',
    shopName: 'Asha',
    reduction: { autopilot: false },
  };
}

function makeOrder(patch: Record<string, unknown> = {}) {
  const doc: any = {
    _id: ORDER_ID,
    sellerId: 'seller-1',
    externalOrderId: '1047',
    stage: 'pending',
    callState: 'held',
    intervention: 'hold_review',
    interventionWhy: 'No confirmation after WhatsApp and a call. Hold for the seller.',
    exception: 'call',
    exceptionWhy: 'call',
    whatsappStatus: 'failed',
    timeline: [
      { at: '2026-10-01T00:00:00.000Z', step: 'call', detail: 'Outbound call placed' },
      { at: '2026-10-01T00:01:00.000Z', step: 'call', detail: 'Simulated call. The buyer was not dialed.' },
    ],
    extraCall: null,
    phoneEnc: 'enc',
    buyerNameEnc: 'enc',
    addressEnc: 'enc',
    orderValue: 499,
    city: 'Jaipur',
    state: 'RJ',
    pincode: '302001',
    shopifyGid: 'gid://shopify/Order/1',
    conversation: [],
    messages: null,
    prepaid: null,
    paymentType: 'cod',
    callConversationId: '',
    ...patch,
  };
  doc.save = jest.fn(async () => doc);
  return doc;
}

function harness(plan: { mode: string; notice: string | null; conversationId: string }, current = makeOrder()) {
  const orders = {
    findOne: jest.fn(async () => current),
    findById: jest.fn(async () => current),
  };
  const users = { findById: jest.fn(async () => seller()) };
  const calls = { place: jest.fn(async () => ({ ...plan, signedUrl: null, variables: {} })) };
  const audit = { create: jest.fn(async () => undefined) };
  const shopify = {
    cancelOrder: jest.fn(async () => undefined),
    updateShippingAddress: jest.fn(async () => undefined),
    tag: jest.fn(async () => undefined),
    createPrepaidDraft: jest.fn(),
  };
  const whatsapp = { dispatchFlow: jest.fn(async () => 'simulated'), sendSessionLine: jest.fn(async () => true) };
  const demo = {
    note: jest.fn(async () => undefined),
    actionsToday: jest.fn(async () => 0),
    capture: jest.fn(),
    assertDemoCallWindow: jest.fn(async () => ({ applies: true, remaining: 2 })),
    recordDemoCall: jest.fn(async () => undefined),
  };
  const crypto = { decrypt: jest.fn(() => '9876543210'), encrypt: jest.fn(() => 'enc') };
  const service = new OrdersService(
    orders as never,
    {} as never,
    users as never,
    crypto as never,
    {} as never,
    shopify as never,
    calls as never,
    whatsapp as never,
    demo as never,
    audit as never,
  );
  return { service, current, calls, audit, shopify, whatsapp, demo };
}

describe('Try one more call', () => {
  it('records a simulated call in browser mode, audits it, and refuses a second call', async () => {
    const { service, current, calls, audit } = harness({
      mode: 'simulated',
      notice: 'Simulated call. The buyer was not dialed.',
      conversationId: 'sim-1',
    });
    const first = await service.tryOneMoreCall(seller() as never, ORDER_ID);
    expect(calls.place).toHaveBeenCalledWith(expect.anything(), expect.anything(), '919876543210', true, 'phone');
    expect(first.result).toBe('simulated');
    expect(first.notice).toBe('Simulated call. The buyer was not dialed.');
    expect(first.order.extraCall).toMatchObject({ mode: 'simulated', outcome: 'simulated' });
    expect(current.callState).toBe('held');
    expect(current.stage).toBe('pending');
    expect(audit.create).toHaveBeenCalledWith({
      sellerId: 'seller-1',
      action: 'call.extra',
      orderId: ORDER_ID,
      meta: { mode: 'simulated', outcome: 'simulated' },
    });
    const recorded = (audit.create as jest.Mock).mock.calls[0][0] as { meta: Record<string, unknown> };
    expect(recorded.meta).not.toHaveProperty('phone');
    await expect(service.tryOneMoreCall(seller() as never, ORDER_ID)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('places a real call when the platform returns a phone call', async () => {
    const { service, current, audit } = harness({ mode: 'phone', notice: null, conversationId: 'conv-live' });
    const body = await service.tryOneMoreCall(seller() as never, ORDER_ID);
    expect(body.result).toBe('calling');
    expect(body.mode).toBe('phone');
    expect(body.notice).toBeNull();
    expect(current.extraCall).toMatchObject({ mode: 'phone', outcome: 'calling', conversationId: 'conv-live' });
    expect(current.callState).toBe('held');
    expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'call.extra',
      meta: { mode: 'phone', outcome: 'calling' },
    }));
  });

  it('refuses a seller browser call', async () => {
    const { service, calls } = harness({ mode: 'browser', notice: null, conversationId: '' });
    await expect(service.placeCall(seller() as never, ORDER_ID, true)).rejects.toBeInstanceOf(BadRequestException);
    expect(calls.place).not.toHaveBeenCalled();
  });

  it('lets a throwaway demo shop open the browser call and refuses the extra call', async () => {
    const { service, calls, current } = harness({
      mode: 'simulated',
      notice: 'Simulated call. The buyer was not dialed.',
      conversationId: 'sim-shop',
    });
    const shop = { ...seller(), isDemo: true };
    const body = await service.placeCall(shop as never, ORDER_ID, true);
    expect(body.mode).toBe('simulated');
    expect(current.extraCall).toBeNull();
    expect(calls.place).toHaveBeenCalledTimes(1);
    await expect(service.tryOneMoreCall(shop as never, ORDER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    expect(calls.place).toHaveBeenCalledTimes(1);
  });

  it('refuses an extra call for a judge session', async () => {
    const { service, calls } = harness({ mode: 'phone', notice: null, conversationId: 'conv-judge' });
    const judge = { ...seller(), $locals: { actor: 'demo' as const } };
    await expect(service.tryOneMoreCall(judge as never, ORDER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    expect(calls.place).not.toHaveBeenCalled();
  });

  it('checks the half-hour window before a demo browser call', async () => {
    const { service, calls, demo } = harness({ mode: 'browser', notice: null, conversationId: '' });
    demo.assertDemoCallWindow.mockRejectedValueOnce(new HttpException('Two demo calls are used in this half hour.', 429));
    const demoUser = { ...seller(), role: 'demo' };
    await expect(service.placeCall(demoUser as never, ORDER_ID, true, '203.0.113.9')).rejects.toBeInstanceOf(HttpException);
    expect(calls.place).not.toHaveBeenCalled();
    expect(demo.recordDemoCall).not.toHaveBeenCalled();
  });

  it('keeps the demo browser call and does not spend the extra call', async () => {
    const { service, current, demo } = harness({
      mode: 'simulated',
      notice: 'Simulated call. The buyer was not dialed.',
      conversationId: 'sim-demo',
    });
    const demoUser = { ...seller(), role: 'demo' };
    const body = await service.placeCall(demoUser as never, ORDER_ID, true);
    expect(body.mode).toBe('simulated');
    expect(body.order.extraCall).toBeNull();
    expect(current.timeline.some((step: { detail: string }) => step.detail.startsWith('Simulated call'))).toBe(true);
    expect(demo.recordDemoCall).toHaveBeenCalled();
    expect(demo.assertDemoCallWindow).toHaveBeenCalled();
  });

  it('closes a confirmed extra call and drops it from Exceptions', async () => {
    const current = makeOrder({
      extraCall: { at: '2026-10-02T00:00:00.000Z', mode: 'phone', outcome: 'calling', conversationId: 'conv-1' },
    });
    const { service } = harness({ mode: 'phone', notice: null, conversationId: 'conv-1' }, current);
    await service.applyVoiceOutcome({
      orderId: ORDER_ID,
      outcome: 'confirmed',
      landmark: '',
      address: '',
      conversationId: 'conv-1',
    });
    expect(current.stage).toBe('closed');
    expect(current.outcome).toBe('confirmed');
    expect(current.exception).toBeNull();
    expect(current.whatsappStatus).toBe('read');
    expect(current.extraCall.outcome).toBe('confirmed');
  });

  it('leaves Confirm and Cancel in place when nobody answers', async () => {
    const current = makeOrder({
      extraCall: { at: '2026-10-02T00:00:00.000Z', mode: 'phone', outcome: 'calling', conversationId: 'conv-1' },
    });
    const { service } = harness({ mode: 'phone', notice: null, conversationId: 'conv-1' }, current);
    await service.applyVoiceOutcome({
      orderId: ORDER_ID,
      outcome: 'no_response',
      landmark: '',
      address: '',
      conversationId: 'conv-1',
    });
    expect(current.stage).toBe('pending');
    expect(current.intervention).toBe('hold_review');
    expect(current.exception).toBe('call');
    expect(current.extraCall.outcome).toBe('no_answer');
  });

  it('continues the address pipeline when the buyer changes the address', async () => {
    const current = makeOrder({
      extraCall: { at: '2026-10-02T00:00:00.000Z', mode: 'phone', outcome: 'calling', conversationId: 'conv-1' },
      shopifyGid: '',
    });
    const { service, whatsapp } = harness({ mode: 'phone', notice: null, conversationId: 'conv-1' }, current);
    await service.applyVoiceOutcome({
      orderId: ORDER_ID,
      outcome: 'address',
      landmark: 'near the temple',
      address: '12 Lane',
      conversationId: 'conv-1',
    });
    expect(current.stage).toBe('pending');
    expect(current.exception).toBeNull();
    expect(current.intervention).toBe('confirm');
    expect(current.extraCall.outcome).toBe('address');
    expect(whatsapp.dispatchFlow).toHaveBeenCalledWith(expect.anything(), current, 'address_updated_confirmation');
  });

  it('ignores a webhook for a different conversation', async () => {
    const current = makeOrder({
      extraCall: { at: '2026-10-02T00:00:00.000Z', mode: 'phone', outcome: 'calling', conversationId: 'conv-1' },
    });
    const { service } = harness({ mode: 'phone', notice: null, conversationId: 'conv-1' }, current);
    await service.applyVoiceOutcome({
      orderId: ORDER_ID,
      outcome: 'confirmed',
      landmark: '',
      address: '',
      conversationId: 'other',
    });
    expect(current.extraCall.outcome).toBe('calling');
    expect(current.stage).toBe('pending');
  });
});
