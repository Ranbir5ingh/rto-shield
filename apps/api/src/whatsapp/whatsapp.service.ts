import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CryptoService } from '../common/crypto.service';
import { whatsappNumber } from '../common/phone';
import { VaultService } from '../common/vault.service';
import { AuditEvent } from '../database/audit.schema';
import { Order, type OrderDocument } from '../database/order.schema';
import { PlatformFlag, WHATSAPP_WEBHOOK_VERIFIED_KEY } from '../database/platform.schema';
import { User, type UserDocument, type WhatsAppLink } from '../database/user.schema';
import { DemoService } from '../demo/demo.service';
import { whatsappAllowlist } from '../demo/demo-send';
import { demoSendCap, effectiveRole } from '../demo/demo.policy';
import { pushTimeline, reductionSettings } from '../orders/action';
import { ShopifyService } from '../shopify/shopify.service';
import { connectionReport, type ProbeResult } from './whatsapp-connection';
import {
  ORDER_CONFIRMATION_EN,
  TEMPLATE_REJECTED,
  expectedTemplate,
  explainMetaTemplateError,
  pickTemplateStatus,
  type ListedTemplate,
} from './whatsapp-templates';

const GRAPH = process.env.META_GRAPH_VERSION || 'v23.0';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly vault: VaultService,
    private readonly crypto: CryptoService,
    @Inject(forwardRef(() => ShopifyService)) private readonly shopify: ShopifyService,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(AuditEvent.name) private readonly audit: Model<AuditEvent>,
    @InjectModel(PlatformFlag.name) private readonly platform: Model<PlatformFlag>,
    private readonly demoState: DemoService,
  ) {}

  verifyToken() {
    return this.config.get<string>('WHATSAPP_VERIFY_TOKEN')?.trim() || '';
  }

  callbackUrl() {
    const app = (this.config.get<string>('SHOPIFY_APP_URL') || 'https://www.rtoshield.tech').replace(/\/$/, '');
    return `${app}/api/whatsapp/webhook`;
  }

  async status(user: UserDocument) {
    const link = user.whatsapp;
    const visitor = effectiveRole(user) === 'demo';
    return {
      configured: Boolean(link?.tokenEnvelope && link.phoneNumberId && link.wabaId),
      demo: Boolean(user.isDemo) || visitor,
      phoneNumberId: visitor ? '' : link?.phoneNumberId || '',
      wabaId: visitor ? '' : link?.wabaId || '',
      tokenLast4: visitor ? '' : link?.tokenLast4 || '',
      appSecretLast4: visitor ? '' : link?.appSecretLast4 || '',
      templateName: link?.templateName || 'order_confirmation',
      templateStatus: link?.templateStatus || 'missing',
      templateLanguage: link?.templateLanguage || user.messageLanguage,
      callbackUrl: this.callbackUrl(),
      verifyTokenName: 'WHATSAPP_VERIFY_TOKEN',
      verifyToken: visitor || user.role === 'staff' ? '' : this.verifyToken(),
      webhookVerified: Boolean(await this.webhookVerifiedAt()),
    };
  }

  async markWebhookVerified() {
    try {
      await this.platform.updateOne(
        { key: WHATSAPP_WEBHOOK_VERIFIED_KEY },
        { $set: { value: new Date().toISOString() } },
        { upsert: true },
      );
    } catch (error) {
      this.logger.warn(`WhatsApp verify flag missed: ${error instanceof Error ? error.name : 'error'}`);
    }
  }

  async webhookVerifiedAt() {
    const row = await this.platform.findOne({ key: WHATSAPP_WEBHOOK_VERIFIED_KEY }).lean();
    return row?.value || '';
  }

  async testConnection(user: UserDocument) {
    if (user.role === 'staff') throw new ForbiddenException('Only the shop owner can test the WhatsApp connection');
    const link = user.whatsapp;
    const hasToken = Boolean(link?.tokenEnvelope);
    const hasPhone = Boolean(link?.phoneNumberId);
    const hasWaba = Boolean(link?.wabaId);
    let phone: ProbeResult = 'skipped';
    let waba: ProbeResult = 'skipped';
    let templateStatus: string | null = 'missing';
    if (hasToken && link?.tokenEnvelope && (hasPhone || hasWaba)) {
      const token = this.vault.open(link.tokenEnvelope);
      if (hasPhone) phone = await this.probeGraph(`${link.phoneNumberId}?fields=id,display_phone_number,verified_name`, token);
      if (hasWaba) {
        waba = await this.probeGraph(`${link.wabaId}?fields=id,name`, token);
        const expected = expectedTemplate(user.messageLanguage);
        const listed = await this.templateState(link, token, expected);
        templateStatus = listed === null ? null : listed || 'missing';
        if (listed) {
          user.whatsapp = {
            ...link,
            templateName: expected.name,
            templateLanguage: expected.language,
            templateStatus: listed,
          };
          await user.save();
        }
      }
    }
    const report = connectionReport({
      hasToken,
      hasPhone,
      hasWaba,
      phone,
      waba,
      templateStatus,
      webhookVerified: Boolean(await this.webhookVerifiedAt()),
    });
    await this.audit.create({
      sellerId: user._id,
      action: 'whatsapp.test_connection',
      meta: { ok: report.ok },
    });
    return report;
  }

  async save(
    user: UserDocument,
    input: { accessToken?: string; phoneNumberId: string; wabaId: string; appSecret?: string },
  ) {
    if (user.role === 'staff') throw new BadRequestException('Only the shop owner can change connections');
    const phoneNumberId = input.phoneNumberId.trim();
    const wabaId = input.wabaId.trim();
    if (!/^\d{6,30}$/.test(phoneNumberId) || !/^\d{6,30}$/.test(wabaId)) {
      throw new BadRequestException('Phone Number ID and WABA ID should be numeric');
    }
    const token = input.accessToken?.trim() || '';
    const existing = user.whatsapp;
    if (!token && !existing?.tokenEnvelope) throw new BadRequestException('Paste the permanent access token');
    const appSecret = input.appSecret?.trim() || '';
    const link: WhatsAppLink = {
      tokenEnvelope: token ? this.vault.seal(token) : existing!.tokenEnvelope,
      tokenLast4: token ? this.vault.mask(token) : existing!.tokenLast4,
      phoneNumberId,
      wabaId,
      appSecretEnvelope: appSecret ? this.vault.seal(appSecret) : existing?.appSecretEnvelope || null,
      appSecretLast4: appSecret ? this.vault.mask(appSecret) : existing?.appSecretLast4 || '',
      templateName: 'order_confirmation',
      templateStatus: user.whatsapp?.templateStatus || 'missing',
      templateLanguage: user.messageLanguage,
    };
    user.whatsapp = link;
    await user.save();
    await this.audit.create({ sellerId: user._id, action: 'whatsapp.save', meta: { phoneLast4: link.tokenLast4 } });
    return this.status(user);
  }

  async sendTest(user: UserDocument, to: string) {
    const number = whatsappNumber(to);
    if (!number) throw new BadRequestException('Enter a mobile number with country code');
    await this.graphSend(user, {
      messaging_product: 'whatsapp',
      to: number,
      type: 'template',
      template: { name: 'hello_world', language: { code: 'en_US' } },
    });
    await this.audit.create({ sellerId: user._id, action: 'whatsapp.test', orderId: '', meta: { toLast4: number.slice(-4) } });
    return { sent: true };
  }

  async submitTemplate(user: UserDocument) {
    const link = this.requireLink(user);
    const secret = this.vault.open(link.tokenEnvelope);
    const templates = [
      { name: 'order_confirmation', language: 'en' as const, text: ORDER_CONFIRMATION_EN },
      { name: 'order_confirmation', language: 'hi' as const, text: 'नमस्ते {{1}}, कृपया ₹{{3}} का कैश ऑन डिलीवरी ऑर्डर {{2}} कन्फर्म करें।' },
      { name: 'order_confirmation_hinglish', language: 'en' as const, text: 'Namaste {{1}}, aapka COD order {{2}} of Rs {{3}} confirm karna hai.' },
    ];
    for (const template of templates) {
      await this.createTemplate(link.wabaId, secret, template);
    }
    const expected = expectedTemplate(user.messageLanguage);
    const listed = await this.templateState(link, secret, expected);
    user.whatsapp = {
      ...link,
      templateName: expected.name,
      templateLanguage: expected.language,
      templateStatus: listed || 'submitted',
    };
    await user.save();
    return this.status(user);
  }

  async refreshTemplate(user: UserDocument) {
    const link = this.requireLink(user);
    const expected = expectedTemplate(user.messageLanguage);
    const listed = await this.templateState(link, this.vault.open(link.tokenEnvelope), expected);
    user.whatsapp = {
      ...link,
      templateName: expected.name,
      templateLanguage: expected.language,
      templateStatus: listed === null ? link.templateStatus : listed || 'missing',
    };
    await user.save();
    return this.status(user);
  }

  async sendOrders(user: UserDocument, ids: string[]) {
    if (user.role === 'staff') throw new BadRequestException('Only the shop owner can send WhatsApp messages');
    const visitor = effectiveRole(user) === 'demo';
    const synthetic = Boolean(user.isDemo && !user.whatsapp?.tokenEnvelope);
    if (!visitor && !synthetic) {
      const link = this.requireLink(user);
      if (link.templateStatus !== 'APPROVED') {
        throw new BadRequestException('The order_confirmation template is not approved yet');
      }
    }
    const orders = await this.orders.find({ _id: { $in: ids }, sellerId: user._id, stage: 'pending' }).limit(50);
    if (visitor) await this.demoState.capture(user, orders);
    const sent: string[] = [];
    let simulated = 0;
    const allow = new Set(whatsappAllowlist(process.env.DEMO_WHATSAPP_ALLOWLIST));
    for (const order of orders) {
      const phone = this.phoneOf(order);
      if (!phone) continue;
      const language = user.messageLanguage === 'hindi' ? 'hi' : 'en';
      const name = user.messageLanguage === 'hinglish' ? 'order_confirmation_hinglish' : 'order_confirmation';
      const link = user.whatsapp;
      const allowlisted = visitor && allow.has(phone) && Boolean(link?.tokenEnvelope) && link?.templateStatus === 'APPROVED';
      if (visitor && !allowlisted) {
        await this.holdDemoSend(user);
        this.markSimulated(order, name);
        this.stampEscalation(user, order);
        await order.save();
        await this.demoState.note(user, 'demo.whatsapp.simulated', String(order._id), { template: name });
        sent.push(String(order._id));
        simulated += 1;
        continue;
      }
      if (synthetic) {
        this.markSimulated(order, name);
        this.stampEscalation(user, order);
        await order.save();
        sent.push(String(order._id));
        continue;
      }
      if (visitor) await this.holdDemoSend(user);
      const result = await this.graphSend(user, {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name,
          language: { code: language },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: this.firstName(order) },
                { type: 'text', text: order.externalOrderId.slice(0, 30) },
                { type: 'text', text: String(Math.round(order.orderValue)) },
              ],
            },
          ],
        },
      });
      const wamid = result.messages?.[0]?.id || '';
      order.whatsappStatus = 'sent';
      order.whatsappMessageId = wamid;
      order.conversation = [
        ...(order.conversation || []),
        { at: new Date().toISOString(), direction: 'out', kind: 'template', text: `${name} ${order.externalOrderId}` },
      ];
      this.stampEscalation(user, order);
      await order.save();
      if (visitor) {
        await this.demoState.note(user, 'demo.whatsapp.send', String(order._id), { template: name });
      } else {
        await this.audit.create({
          sellerId: user._id,
          action: 'whatsapp.send',
          orderId: String(order._id),
          meta: { wamid, template: name },
        });
      }
      sent.push(String(order._id));
    }
    if (visitor && simulated) {
      return { sent, simulated, notice: 'In the demo, messages go to our test phone' };
    }
    return { sent, simulated };
  }

  private async holdDemoSend(user: UserDocument) {
    const used = await this.demoState.sendsToday(user);
    this.demoState.assertSendRoom(used, demoSendCap());
  }

  private markSimulated(order: OrderDocument, template: string) {
    order.whatsappStatus = 'sent';
    order.whatsappMessageId = `demo-${order.id}`;
    order.conversation = [
      ...(order.conversation || []),
      { at: new Date().toISOString(), direction: 'out', kind: 'template', text: template },
    ];
  }

  async applyInbound(phoneNumberId: string, payload: Record<string, unknown>) {
    const user = await this.users.findOne({ 'whatsapp.phoneNumberId': phoneNumberId });
    if (!user) return;
    const entries = Array.isArray(payload.entry) ? (payload.entry as Array<Record<string, unknown>>) : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? (entry.changes as Array<Record<string, unknown>>) : [];
      for (const change of changes) {
        const value = (change.value || {}) as Record<string, unknown>;
        const statuses = Array.isArray(value.statuses) ? (value.statuses as Array<Record<string, unknown>>) : [];
        for (const status of statuses) {
          await this.applyStatus(user, String(status.id || ''), String(status.status || ''));
        }
        const messages = Array.isArray(value.messages) ? (value.messages as Array<Record<string, unknown>>) : [];
        for (const message of messages) {
          await this.applyButton(user, message);
          await this.applyText(user, message);
        }
      }
    }
  }

  findByPhone(phoneNumberId: string) {
    return this.users.findOne({ 'whatsapp.phoneNumberId': phoneNumberId });
  }

  secretForPhone(user: UserDocument): string {
    return user.whatsapp?.appSecretEnvelope ? this.vault.open(user.whatsapp.appSecretEnvelope) : '';
  }

  private async applyStatus(user: UserDocument, wamid: string, status: string) {
    if (!wamid) return;
    const next = status === 'read' || status === 'delivered' || status === 'failed' || status === 'sent' ? status : '';
    if (!next) return;
    await this.orders.updateOne(
      { sellerId: user._id, whatsappMessageId: wamid },
      { $set: { whatsappStatus: next } },
    );
  }

  async sendCheckoutLink(user: UserDocument, order: OrderDocument, url: string): Promise<{ delivered: boolean; notice: string | null }> {
    const phone = this.phoneOf(order);
    const visitor = effectiveRole(user) === 'demo';
    const note = 'WhatsApp can only send a template on the first message. The checkout link is on the order.';
    if (!phone || !user.whatsapp?.tokenEnvelope || visitor) {
      order.conversation = [
        ...(order.conversation || []),
        { at: new Date().toISOString(), direction: 'out', kind: 'link', text: 'Prepaid checkout link' },
      ];
      await order.save();
      return { delivered: false, notice: visitor ? 'In the demo, the checkout link stays on this order.' : note };
    }
    try {
      await this.graphSend(user, {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: `Pay now and save: ${url}`.slice(0, 1000) },
      });
      order.conversation = [
        ...(order.conversation || []),
        { at: new Date().toISOString(), direction: 'out', kind: 'text', text: 'Prepaid checkout link' },
      ];
      await order.save();
      return { delivered: true, notice: null };
    } catch (error) {
      this.logger.warn(`Checkout link missed: ${error instanceof Error ? error.name : 'error'}`);
      return { delivered: false, notice: note };
    }
  }

  private stampEscalation(user: UserDocument, order: OrderDocument) {
    if (order.riskBand !== 'High' || order.callDueAt) return;
    const minutes = reductionSettings(user).escalationMinutes;
    const delay = effectiveRole(user) === 'demo' ? 0 : minutes * 60_000;
    order.callDueAt = new Date(Date.now() + delay);
    order.timeline = pushTimeline(order.timeline, 'whatsapp', 'WhatsApp sent. A call follows if there is no reply.');
  }

  private async applyText(user: UserDocument, message: Record<string, unknown>) {
    const context = (message.context || {}) as { id?: string };
    const text = String((message.text as { body?: string } | undefined)?.body || '').trim();
    if (!context.id || text.length < 8 || /^(confirm|cancel|haan|nahi|ok|yes|no)$/i.test(text)) return;
    const order = await this.orders.findOne({ sellerId: user._id, whatsappMessageId: context.id });
    if (!order || order.stage !== 'pending') return;
    order.addressEnc = this.crypto.encrypt(text.slice(0, 300));
    order.addressFixedAt = new Date();
    order.timeline = pushTimeline(order.timeline, 'address', 'Buyer reply updated the address');
    order.conversation = [
      ...(order.conversation || []),
      { at: new Date().toISOString(), direction: 'in', kind: 'text', text: 'Address reply' },
    ];
    await order.save();
    void this.shopify
      .updateShippingAddress(user, order.shopifyGid, {
        address1: text.slice(0, 200),
        city: order.city,
        province: order.state,
        zip: order.pincode,
      })
      .catch((error: unknown) => {
        this.logger.warn(`Address writeback missed: ${error instanceof Error ? error.name : 'error'}`);
      });
  }

  private async applyButton(user: UserDocument, message: Record<string, unknown>) {
    const context = (message.context || {}) as { id?: string };
    const button = (message.button || message.interactive || {}) as { text?: string; payload?: string };
    const text = String(button.text || button.payload || '').toLowerCase();
    const decision = text.includes('cancel') ? 'cancelled' : text.includes('confirm') ? 'confirmed' : '';
    if (!decision || !context.id) return;
    const order = await this.orders.findOne({ sellerId: user._id, whatsappMessageId: context.id });
    if (!order || order.stage !== 'pending') return;
    order.outcome = decision;
    order.stage = 'closed';
    order.conversation = [
      ...(order.conversation || []),
      { at: new Date().toISOString(), direction: 'in', kind: 'button', text: decision },
    ];
    await order.save();
    await this.audit.create({
      sellerId: user._id,
      action: 'whatsapp.reply',
      orderId: String(order._id),
      meta: { decision },
    });
    if (order.shopifyGid) {
      await this.shopify.tagDecision(user, order.shopifyGid, decision);
      if (decision === 'cancelled') {
        try {
          await this.shopify.cancelOrder(user, order.shopifyGid);
        } catch (error) {
          this.logger.warn(`Shopify cancel missed: ${error instanceof Error ? error.name : 'error'}`);
        }
      }
    }
  }

  private async createTemplate(
    wabaId: string,
    token: string,
    template: { name: string; language: 'en' | 'hi'; text: string },
  ) {
    let response: Response;
    try {
      response = await fetch(`https://graph.facebook.com/${GRAPH}/${wabaId}/message_templates`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          name: template.name,
          language: template.language,
          category: 'UTILITY',
          components: [
            { type: 'BODY', text: template.text, example: { body_text: [['Asha', '1042', '799']] } },
            {
              type: 'BUTTONS',
              buttons: [
                { type: 'QUICK_REPLY', text: 'Confirm' },
                { type: 'QUICK_REPLY', text: 'Cancel' },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      this.logger.warn(`WhatsApp template ${template.name} ${template.language} missed: ${error instanceof Error ? error.name : 'error'}`);
      throw new BadRequestException('WhatsApp did not answer. Try submitting the template again.');
    }
    if (response.ok) return;
    const explained = explainMetaTemplateError(response.status, await readJson(response));
    this.logger.warn(`WhatsApp template ${template.name} ${template.language} rejected: ${explained.log}`);
    throw new BadRequestException(explained.seller || TEMPLATE_REJECTED);
  }

  private async templateState(link: WhatsAppLink, token: string, expected: { name: string; language: 'en' | 'hi' }) {
    const url = new URL(`https://graph.facebook.com/${GRAPH}/${link.wabaId}/message_templates`);
    url.searchParams.set('name', expected.name);
    url.searchParams.set('language', expected.language);
    url.searchParams.set('limit', '50');
    let next: string | null = url.toString();
    const rows: ListedTemplate[] = [];
    for (let page = 0; page < 3 && next; page += 1) {
      let response: Response;
      try {
        response = await fetch(next, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
      } catch (error) {
        this.logger.warn(`WhatsApp template list missed: ${error instanceof Error ? error.name : 'error'}`);
        return null;
      }
      if (!response.ok) {
        const explained = explainMetaTemplateError(response.status, await readJson(response));
        this.logger.warn(`WhatsApp template list rejected: ${explained.log}`);
        return null;
      }
      const body = (await readJson(response)) as { data?: ListedTemplate[]; paging?: { next?: string } } | null;
      rows.push(...(body?.data || []));
      const status = pickTemplateStatus(rows, expected);
      if (status) return status;
      next = metaNextPage(body?.paging?.next);
    }
    return pickTemplateStatus(rows, expected);
  }

  private async probeGraph(pathAndQuery: string, token: string): Promise<ProbeResult> {
    try {
      const response = await fetch(`https://graph.facebook.com/${GRAPH}/${pathAndQuery}`, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      });
      const text = await response.text();
      if (!response.ok) return 'rejected';
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        return 'rejected';
      }
      const id = parsed && typeof parsed === 'object' ? (parsed as { id?: unknown }).id : '';
      return typeof id === 'string' && id.length > 0 ? 'ok' : 'rejected';
    } catch (error) {
      this.logger.warn(`WhatsApp probe missed: ${error instanceof Error ? error.name : 'error'}`);
      return 'unreachable';
    }
  }

  private async graphSend(user: UserDocument, body: Record<string, unknown>) {
    const link = this.requireLink(user);
    const token = this.vault.open(link.tokenEnvelope);
    const response = await fetch(`https://graph.facebook.com/${GRAPH}/${link.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new BadRequestException('WhatsApp did not accept the message');
    return (await response.json()) as { messages?: Array<{ id: string }> };
  }

  private requireLink(user: UserDocument): WhatsAppLink {
    if (!user.whatsapp?.tokenEnvelope || !user.whatsapp.phoneNumberId) {
      throw new BadRequestException('Add your WhatsApp token, Phone Number ID, and WABA ID first');
    }
    return user.whatsapp;
  }

  private phoneOf(order: OrderDocument) {
    try {
      return whatsappNumber(this.crypto.decrypt(order.phoneEnc));
    } catch {
      return null;
    }
  }

  private firstName(order: OrderDocument) {
    try {
      const name = this.crypto.decrypt(order.buyerNameEnc).split(/\s+/)[0] || 'ji';
      return name.replace(/[^\p{L}\p{N} .'-]/gu, '').slice(0, 40) || 'ji';
    } catch {
      return 'ji';
    }
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function metaNextPage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'graph.facebook.com') return null;
    return url.toString();
  } catch {
    return null;
  }
}
