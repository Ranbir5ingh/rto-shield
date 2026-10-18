import { BadRequestException, forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'crypto';
import { Model } from 'mongoose';
import { CryptoService } from '../common/crypto.service';
import { VaultService } from '../common/vault.service';
import { hourInKolkata } from '../common/hour';
import { maskPhone } from '../common/phone';
import { effectiveRole } from '../demo/demo.policy';
import { AuditEvent } from '../database/audit.schema';
import { OauthState } from '../database/oauth-state.schema';
import { Order } from '../database/order.schema';
import { User, type ShopifyLink, type UserDocument } from '../database/user.schema';
import { OrdersService } from '../orders/orders.service';
import { shopifyShippingAddress } from './india-province';
import {
  ShopifyQueryError,
  blockingUserErrors,
  explainShopify,
  hasGraphqlErrors,
  shopifyFailure,
  topicsToRegister,
  webhookAlreadyRegistered,
  type ShopifyUserError,
} from './shopify-errors';
import { pushTimeline } from '../orders/action';
import { backfillSince, mapGraphqlOrder, mapRestOrder, normalizeShop, shopifyOutcomeUpdate, staleRiskTags, type MappedOrder } from './shopify-map';

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-10';

const ORDER_FIELDS = `
  id name createdAt cancelledAt displayFinancialStatus displayFulfillmentStatus tags phone
  paymentGatewayNames
  totalPriceSet { shopMoney { amount } }
  shippingAddress { address1 address2 city province zip phone name }
  customer { id displayName phone }
  lineItems(first: 3) { edges { node { name } } }
  fulfillments { status displayStatus }
  refunds { id createdAt }
`;

type OrderConnection = {
  orders: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: Array<{ node: Record<string, unknown> }>;
  };
};

function webhookScoreTarget(body: Record<string, unknown>) {
  const id = body.id === undefined || body.id === null ? '' : String(body.id);
  const name = String(body.name || '');
  const gid = String(body.admin_graphql_api_id || (id ? `gid://shopify/Order/${id}` : ''));
  const tags = String(body.tags || '')
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  const externalIds = [name, id, id ? `#${id}` : ''].filter(Boolean);
  return {
    gids: gid ? [gid] : [],
    externalIds,
    rtoTest: tags.includes('rto-test'),
    addressWriteBack: tags.includes('rto-address-fixed'),
  };
}

function defaultLink(shop: string, demo: boolean): ShopifyLink {
  return {
    shopDomain: shop,
    demo,
    scopes: process.env.SHOPIFY_SCOPES || 'read_orders,write_orders,read_fulfillments,read_customers,write_draft_orders',
    tokenEnvelope: null,
    installedAt: new Date().toISOString(),
    uninstalledAt: null,
    backfill: { status: demo ? 'done' : 'idle', processed: demo ? 204 : 0, total: demo ? 204 : 0, error: null },
    riskTags: { high: 'rto-high', medium: 'rto-medium', low: 'rto-low' },
    rtoTag: 'RTO',
    autoCancelOnBuyerCancel: false,
  };
}

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly vault: VaultService,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(OauthState.name) private readonly states: Model<OauthState>,
    @InjectModel(AuditEvent.name) private readonly audit: Model<AuditEvent>,
    @Inject(forwardRef(() => OrdersService)) private readonly orderBook: OrdersService,
  ) {}

  appUrl() {
    return (this.config.get<string>('SHOPIFY_APP_URL') || 'https://www.rtoshield.tech').replace(/\/$/, '');
  }

  scopes() {
    return this.config.get<string>('SHOPIFY_SCOPES') || 'read_orders,write_orders,read_fulfillments,read_customers,write_draft_orders';
  }

  status(user: UserDocument) {
    const link = user.shopify;
    return {
      connected: Boolean(link && !link.uninstalledAt && (link.demo || link.tokenEnvelope)),
      demo: Boolean(link?.demo),
      shop: link?.shopDomain || null,
      backfill: link?.backfill || { status: 'idle', processed: 0, total: 0, error: null },
      riskTags: link?.riskTags || { high: 'rto-high', medium: 'rto-medium', low: 'rto-low' },
      rtoTag: link?.rtoTag || 'RTO',
      autoCancelOnBuyerCancel: Boolean(link?.autoCancelOnBuyerCancel),
    };
  }

  async beginInstall(user: UserDocument, shopInput: string) {
    this.assertOwner(user);
    const shop = normalizeShop(shopInput);
    if (!shop) throw new BadRequestException('Enter the shop as your-store.myshopify.com');
    const key = this.config.get<string>('SHOPIFY_API_KEY')?.trim();
    if (!key) throw new BadRequestException('SHOPIFY_API_KEY is not set on the server yet');
    const state = randomBytes(24).toString('hex');
    await this.states.create({
      state,
      sellerId: user._id,
      shop,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    const redirect = `${this.appUrl()}/api/shopify/callback`;
    const url = new URL(`https://${shop}/admin/oauth/authorize`);
    url.searchParams.set('client_id', key);
    url.searchParams.set('scope', this.scopes());
    url.searchParams.set('redirect_uri', redirect);
    url.searchParams.set('state', state);
    return { url: url.toString(), shop };
  }

  async completeInstall(query: Record<string, string>) {
    const saved = await this.states.findOneAndDelete({ state: query.state || '' });
    if (!saved || saved.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('This Shopify install link has expired. Start again from the shop.');
    }
    if (saved.shop !== query.shop) throw new BadRequestException('Shop did not match the install request');
    const secret = this.config.get<string>('SHOPIFY_API_SECRET')?.trim() || '';
    const key = this.config.get<string>('SHOPIFY_API_KEY')?.trim() || '';
    const body = new URLSearchParams({ client_id: key, client_secret: secret, code: query.code || '' });
    const response = await fetch(`https://${saved.shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new BadRequestException('Shopify did not return an access token');
    const payload = (await response.json()) as { access_token?: string; scope?: string };
    if (!payload.access_token) throw new BadRequestException('Shopify did not return an access token');
    const user = await this.users.findById(saved.sellerId);
    if (!user) throw new BadRequestException('Shop account was not found');
    const link = defaultLink(saved.shop, false);
    link.scopes = payload.scope || this.scopes();
    link.tokenEnvelope = this.vault.seal(payload.access_token);
    link.backfill = { status: 'running', processed: 0, total: 0, error: null };
    user.shopify = link;
    await user.save();
    await this.audit.create({ sellerId: user._id, action: 'shopify.install', meta: { shop: saved.shop } });
    this.startBackfill(user);
    void this.ensureWebhooks(saved.shop, payload.access_token).catch((error: unknown) => {
      this.warnShopify('Shopify webhooks missed', error);
    });
    return user;
  }

  async updateSettings(
    user: UserDocument,
    input: { rtoTag?: string; autoCancelOnBuyerCancel?: boolean; riskTags?: ShopifyLink['riskTags'] },
  ) {
    this.assertOwner(user);
    if (!user.shopify) throw new BadRequestException('Connect Shopify first');
    user.shopify = {
      ...user.shopify,
      rtoTag: input.rtoTag?.trim().slice(0, 40) || user.shopify.rtoTag,
      autoCancelOnBuyerCancel: input.autoCancelOnBuyerCancel ?? user.shopify.autoCancelOnBuyerCancel,
      riskTags: input.riskTags
        ? {
            high: input.riskTags.high.trim().slice(0, 40) || 'rto-high',
            medium: input.riskTags.medium.trim().slice(0, 40) || 'rto-medium',
            low: input.riskTags.low.trim().slice(0, 40) || 'rto-low',
          }
        : user.shopify.riskTags,
    };
    await user.save();
    return this.status(user);
  }

  async resync(user: UserDocument) {
    this.assertOwner(user);
    if (!user.shopify || user.shopify.demo || !user.shopify.tokenEnvelope) {
      throw new BadRequestException('Connect a live Shopify shop first');
    }
    user.shopify = {
      ...user.shopify,
      backfill: { status: 'running', processed: 0, total: 0, error: null },
    };
    await user.save();
    const token = this.tokenOf(user);
    void this.ensureWebhooks(user.shopify.shopDomain, token).catch((error: unknown) => {
      this.warnShopify('Shopify webhooks missed', error);
    });
    this.startBackfill(user);
    return this.status(user);
  }

  tokenOf(user: UserDocument): string {
    return this.tokenFor(user, false);
  }

  /** Demo shops keep a sealed token. Only an rto-test address write may open it. */
  private tokenFor(user: UserDocument, allowDemo: boolean): string {
    if (!user.shopify?.tokenEnvelope) return '';
    if (user.shopify.demo && !allowDemo) return '';
    return this.vault.open(user.shopify.tokenEnvelope);
  }

  /** Order ids on this shop that Shopify currently tags rto-test. Anything else is left alone. */
  async rtoTestOrderGids(user: UserDocument): Promise<Set<string>> {
    const token = this.tokenFor(user, true);
    const shop = user.shopify?.shopDomain;
    if (!token || !shop) return new Set();
    const data = await this.graphql<{
      orders?: { edges?: Array<{ node?: { id?: string | null; tags?: string[] | null } | null }> };
    }>(shop, token, `query { orders(first: 50, query: "tag:rto-test") { edges { node { id tags } } } }`, {});
    const ids = new Set<string>();
    for (const edge of data.orders?.edges || []) {
      const id = edge.node?.id || '';
      const tags = Array.isArray(edge.node?.tags) ? edge.node.tags : [];
      if (id && tags.some((tag) => tag.trim().toLowerCase() === 'rto-test')) ids.add(id);
    }
    return ids;
  }

  startBackfill(user: UserDocument) {
    const id = String(user._id);
    if (this.running.has(id) || user.shopify?.demo) return;
    this.running.add(id);
    setImmediate(() => {
      void this.backfill(user).finally(() => this.running.delete(id));
    });
  }

  private async backfill(user: UserDocument) {
    const shop = user.shopify?.shopDomain;
    const token = this.tokenOf(user);
    if (!shop || !token) return;
    const since = backfillSince();
    let cursor: string | null = null;
    let processed = 0;
    try {
      for (let page = 0; page < 80; page += 1) {
        const data: OrderConnection = await this.graphql<OrderConnection>(shop, token, `query($cursor: String, $q: String) { orders(first: 50, after: $cursor, query: $q, sortKey: CREATED_AT) { pageInfo { hasNextPage endCursor } edges { node { ${ORDER_FIELDS} } } } }`, {
          cursor,
          q: `created_at:>='${since}'`,
        });
        const edges = data.orders?.edges || [];
        for (const edge of edges) {
          const mapped = mapGraphqlOrder(edge.node, user.shopify?.rtoTag || 'RTO');
          if (mapped) await this.upsert(user, mapped);
        }
        processed += edges.length;
        await this.users.updateOne(
          { _id: user._id },
          { $set: { 'shopify.backfill': { status: 'running', processed, total: processed, error: null } } },
        );
        if (!data.orders?.pageInfo?.hasNextPage) break;
        cursor = data.orders.pageInfo.endCursor;
      }
      await this.users.updateOne(
        { _id: user._id },
        { $set: { 'shopify.backfill': { status: 'done', processed, total: processed, error: null } } },
      );
      const fresh = await this.users.findById(user._id);
      if (fresh) this.scheduleScore(fresh);
    } catch (error) {
      const detail = this.warnShopify('Shopify backfill stopped', error);
      await this.users.updateOne(
        { _id: user._id },
        { $set: { 'shopify.backfill': { status: 'error', processed, total: processed, error: detail.seller } } },
      );
    }
  }

  async applyRestOrder(user: UserDocument, body: Record<string, unknown>) {
    const mapped = mapRestOrder(body, user.shopify?.rtoTag || 'RTO');
    if (!mapped) return;
    await this.upsert(user, mapped);
  }

  async upsert(user: UserDocument, mapped: MappedOrder) {
    const phone = mapped.phone || '';
    const fields = {
      buyerNameEnc: this.crypto.encrypt(mapped.buyerName || 'Buyer'),
      phoneEnc: this.crypto.encrypt(phone),
      phoneMasked: phone ? maskPhone(phone) : '—',
      addressEnc: this.crypto.encrypt(mapped.address || ''),
      city: mapped.city,
      state: mapped.state,
      pincode: /^\d{6}$/.test(mapped.pincode) ? mapped.pincode : '000000',
      orderValue: mapped.orderValue,
      paymentType: mapped.paymentType,
      orderedAt: mapped.orderedAt,
      hour: hourInKolkata(mapped.orderedAt),
      productName: mapped.productName,
      courier: mapped.courier,
      shopifyGid: mapped.shopifyGid,
      source: 'shopify' as const,
    };
    const terminal = shopifyOutcomeUpdate(mapped.outcome);
    const $set: Record<string, unknown> = fields;
    const $setOnInsert: Record<string, unknown> = {
      sellerId: user._id,
      externalOrderId: mapped.externalOrderId,
      priorOrders: 0,
      priorRtos: 0,
      riskScore: null,
      riskBand: null,
      reasons: [],
    };
    if (terminal) {
      $set.stage = terminal.stage;
      $set.outcome = terminal.outcome;
    } else {
      $setOnInsert.stage = 'pending';
      $setOnInsert.outcome = null;
    }
    await this.orders.updateOne(
      { sellerId: user._id, externalOrderId: mapped.externalOrderId },
      { $set, $setOnInsert },
      { upsert: true },
    );
  }

  async writeRisk(user: UserDocument, rows: Array<{ shopifyGid: string; band: string | null; reasons: string[] }>) {
    const token = this.tokenOf(user);
    const shop = user.shopify?.shopDomain;
    if (!token || !shop || user.shopify?.demo) return;
    const tags = user.shopify?.riskTags || { high: 'rto-high', medium: 'rto-medium', low: 'rto-low' };
    for (const row of rows) {
      if (!row.shopifyGid || !row.band) continue;
      const { add, remove } = staleRiskTags(tags, row.band);
      const note = row.reasons.slice(0, 3).join('; ').slice(0, 400);
      try {
        if (remove.length) {
          await this.graphql(shop, token, `mutation($id: ID!, $tags: [String!]!) { tagsRemove(id: $id, tags: $tags) { userErrors { message } } }`, {
            id: row.shopifyGid,
            tags: remove,
          });
        }
        await this.graphql(shop, token, `mutation($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { message } } }`, {
          id: row.shopifyGid,
          tags: [add],
        });
        if (note) {
          await this.graphql(shop, token, `mutation($input: OrderInput!) { orderUpdate(input: $input) { userErrors { message } } }`, {
            input: { id: row.shopifyGid, note: `RTO Shield: ${note}` },
          });
        }
      } catch (error) {
        this.warnShopify('Shopify tag missed', error);
      }
    }
  }

  async cancelOrder(user: UserDocument, gid: string) {
    if (!user.shopify?.autoCancelOnBuyerCancel) return;
    const token = this.tokenOf(user);
    const shop = user.shopify.shopDomain;
    if (!token || !gid || user.shopify.demo) return;
    await this.graphql(
      shop,
      token,
      `mutation($orderId: ID!, $reason: OrderCancelReason!, $refund: Boolean!, $restock: Boolean!, $notifyCustomer: Boolean) {
        orderCancel(orderId: $orderId, reason: $reason, refund: $refund, restock: $restock, notifyCustomer: $notifyCustomer) { userErrors { message } }
      }`,
      { orderId: gid, reason: 'CUSTOMER', refund: false, restock: true, notifyCustomer: false },
    );
    await this.audit.create({ sellerId: user._id, action: 'shopify.cancel', meta: { gid } });
  }

  async tag(user: UserDocument, gid: string, tags: string[], options?: { demoTest?: boolean }) {
    const token = this.tokenFor(user, Boolean(options?.demoTest));
    const shop = user.shopify?.shopDomain;
    const clean = tags.map((tag) => tag.slice(0, 40)).filter(Boolean);
    if (!token || !shop || !gid || !clean.length) return;
    await this.graphql(shop, token, `mutation($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { field message } } }`, {
      id: gid,
      tags: clean,
    });
  }

  async cancelForPolicy(user: UserDocument, gid: string) {
    const token = this.tokenOf(user);
    const shop = user.shopify?.shopDomain;
    if (!token || !shop || !gid || user.shopify?.demo) return;
    await this.graphql(
      shop,
      token,
      `mutation($orderId: ID!, $reason: OrderCancelReason!, $refund: Boolean!, $restock: Boolean!, $notifyCustomer: Boolean) {
        orderCancel(orderId: $orderId, reason: $reason, refund: $refund, restock: $restock, notifyCustomer: $notifyCustomer) { userErrors { message } }
      }`,
      { orderId: gid, reason: 'CUSTOMER', refund: false, restock: true, notifyCustomer: false },
    );
  }

  async tagDecision(user: UserDocument, gid: string, decision: 'confirmed' | 'cancelled') {
    const token = this.tokenOf(user);
    const shop = user.shopify?.shopDomain;
    if (!token || !shop || !gid || user.shopify?.demo) return;
    await this.graphql(shop, token, `mutation($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { message } } }`, {
      id: gid,
      tags: [decision === 'confirmed' ? 'rto-confirmed' : 'rto-cancelled'],
    });
  }

  async uninstall(shop: string) {
    const user = await this.users.findOne({ 'shopify.shopDomain': shop });
    if (!user?.shopify) return;
    user.shopify = { ...user.shopify, tokenEnvelope: null, uninstalledAt: new Date().toISOString() };
    await user.save();
    await this.audit.create({ sellerId: user._id, action: 'shopify.uninstall', meta: { shop } });
  }

  async redactShop(shop: string) {
    const user = await this.users.findOne({ 'shopify.shopDomain': shop });
    if (!user) return;
    await this.orders.deleteMany({ sellerId: user._id, source: 'shopify' });
    user.shopify = null;
    await user.save();
    await this.audit.create({ sellerId: user._id, action: 'shopify.redact', meta: { shop } });
  }

  async redactCustomer(shop: string, customerId: string, orderIds: string[]) {
    const user = await this.users.findOne({ 'shopify.shopDomain': shop });
    if (!user) return;
    const names = orderIds.map((id) => id.replace(/\D/g, '')).filter(Boolean);
    if (names.length) {
      await this.orders.deleteMany({
        sellerId: user._id,
        shopifyGid: { $in: names.map((id) => `gid://shopify/Order/${id}`) },
      });
    }
    await this.audit.create({
      sellerId: user._id,
      action: 'shopify.customer_redact',
      meta: { customer: customerId.slice(0, 40), orders: names.length },
    });
  }

  async applyTopic(shop: string, topic: string, body: Record<string, unknown>) {
    const domain = shop || String(body.shop_domain || '');
    if (topic === 'app/uninstalled') {
      await this.uninstall(domain);
      return;
    }
    if (topic === 'shop/redact') {
      await this.redactShop(domain);
      return;
    }
    if (topic === 'customers/redact') {
      const customer = (body.customer || {}) as { id?: string | number };
      const ids = Array.isArray(body.orders_to_redact) ? body.orders_to_redact.map(String) : [];
      await this.redactCustomer(domain, String(customer.id || ''), ids);
      return;
    }
    if (topic === 'customers/data_request') {
      const user = await this.findByShop(domain);
      if (user) await this.audit.create({ sellerId: user._id, action: 'shopify.data_request', meta: { shop: domain } });
      return;
    }
    const user = await this.findByShop(domain);
    if (!user) return;
    if (topic === 'orders/paid' || (topic === 'orders/updated' && String(body.financial_status || '').toLowerCase() === 'paid')) {
      await this.notePrepaidPaid(user, body);
    }
    if (topic === 'orders/create' || topic === 'orders/updated' || topic === 'orders/cancelled' || topic === 'orders/paid') {
      await this.applyRestOrder(user, body);
      this.scheduleScore(user, webhookScoreTarget(body));
      return;
    }
    if (topic === 'fulfillments/create' || topic === 'fulfillments/update') {
      await this.applyFulfillment(user, body);
      this.scheduleScore(user, webhookScoreTarget({ id: body.order_id }));
      return;
    }
    if (topic === 'refunds/create') {
      await this.applyRefund(user, body);
      this.scheduleScore(user, webhookScoreTarget({ id: body.order_id }));
    }
  }

  private scheduleScore(
    user: UserDocument,
    webhook?: { gids: string[]; externalIds: string[]; rtoTest?: boolean; addressWriteBack?: boolean },
  ) {
    this.orderBook.startUpgrade(user, webhook ? { webhook } : { full: true });
  }

  private async applyFulfillment(user: UserDocument, body: Record<string, unknown>) {
    const orderId = String(body.order_id || '');
    if (await this.refetch(user, orderId)) return;
    const order = await this.loadOrder(user, orderId);
    if (!order) return;
    const shipment = String(body.shipment_status || '').toLowerCase();
    if (shipment === 'failure' || shipment === 'failed' || shipment === 'attempted_delivery') {
      order.outcome = 'rto';
      order.stage = 'history';
      await order.save();
    } else if (shipment === 'delivered') {
      order.outcome = 'delivered';
      order.stage = 'history';
      await order.save();
    }
  }

  private async applyRefund(user: UserDocument, body: Record<string, unknown>) {
    const orderId = String(body.order_id || '');
    if (await this.refetch(user, orderId)) return;
    const order = await this.loadOrder(user, orderId);
    if (!order) return;
    if (order.outcome === 'delivered' || order.stage === 'history') {
      order.outcome = 'rto';
      order.stage = 'history';
      await order.save();
    }
  }

  private async loadOrder(user: UserDocument, orderId: string) {
    if (!orderId) return null;
    return this.orders.findOne({
      sellerId: user._id,
      $or: [
        { shopifyGid: `gid://shopify/Order/${orderId}` },
        { externalOrderId: orderId },
        { externalOrderId: `#${orderId}` },
      ],
    });
  }

  private async refetch(user: UserDocument, orderId: string) {
    const token = this.tokenOf(user);
    const shop = user.shopify?.shopDomain;
    if (!token || !shop || !orderId) return false;
    try {
      const data = await this.graphql<{ order: Record<string, unknown> | null }>(
        shop,
        token,
        `query($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`,
        { id: `gid://shopify/Order/${orderId}` },
      );
      const mapped = data.order ? mapGraphqlOrder(data.order, user.shopify?.rtoTag || 'RTO') : null;
      if (!mapped) return false;
      await this.upsert(user, mapped);
      return true;
    } catch (error) {
      this.warnShopify('Shopify refetch missed', error);
      return false;
    }
  }

  async findByShop(shop: string) {
    return this.users.findOne({ 'shopify.shopDomain': shop, 'shopify.uninstalledAt': null });
  }

  private async ensureWebhooks(shop: string, token: string) {
    const callback = `${this.appUrl()}/api/shopify/webhooks`;
    const existing = await this.listWebhookTopics(shop, token);
    for (const topic of topicsToRegister(existing)) {
      try {
        const data = await this.graphql<{
          webhookSubscriptionCreate?: { userErrors?: Array<{ field?: string[] | null; message?: string | null }> };
        }>(
          shop,
          token,
          `mutation($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
            webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
              userErrors { field message }
            }
          }`,
          { topic, webhookSubscription: { uri: callback, format: 'JSON' } },
        );
        const failures = (data.webhookSubscriptionCreate?.userErrors || []).filter(
          (item) => item.message && !webhookAlreadyRegistered(item.message),
        );
        if (failures.length) {
          const explained = explainShopify({ userErrors: failures });
          this.logger.warn(`Webhook ${topic} rejected: ${explained.log}`);
        }
      } catch (error) {
        this.warnShopify(`Webhook ${topic} missed`, error);
      }
    }
  }

  private async listWebhookTopics(shop: string, token: string): Promise<string[] | null> {
    try {
      const data = await this.graphql<{
        webhookSubscriptions?: { edges?: Array<{ node?: { topic?: string | null } | null }> };
      }>(shop, token, `query { webhookSubscriptions(first: 40) { edges { node { topic } } } }`, {});
      return (data.webhookSubscriptions?.edges || [])
        .map((edge) => edge.node?.topic || '')
        .filter((topic) => topic.length > 0);
    } catch (error) {
      this.warnShopify('Webhook list missed', error);
      return null;
    }
  }

  async createPrepaidDraft(
    user: UserDocument,
    input: {
      externalOrderId: string;
      productName: string;
      orderValue: number;
      discountPct: number;
      buyerName: string;
      address1: string;
      city: string;
      province: string;
      zip: string;
    },
  ): Promise<{ draftGid: string; invoiceUrl: string; simulated: boolean }> {
    const token = this.tokenOf(user);
    const shop = user.shopify?.shopDomain;
    if (!token || !shop || user.shopify?.demo) {
      return {
        draftGid: '',
        invoiceUrl: '',
        simulated: true,
      };
    }
    let data: {
      draftOrderCreate?: {
        draftOrder?: { id?: string; invoiceUrl?: string } | null;
        userErrors?: Array<{ message?: string | null }>;
      };
    };
    try {
      data = await this.graphql(
        shop,
        token,
        `mutation($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder { id invoiceUrl }
          userErrors { field message }
        }
      }`,
        {
        input: {
          lineItems: [
            {
              title: (input.productName || 'Order').slice(0, 120),
              originalUnitPrice: input.orderValue.toFixed(2),
              quantity: 1,
            },
          ],
          shippingAddress: {
            address1: input.address1.slice(0, 200),
            city: input.city,
            province: input.province,
            zip: input.zip,
            countryCode: 'IN',
            firstName: input.buyerName.split(/\s+/)[0]?.slice(0, 40) || 'Buyer',
          },
          appliedDiscount:
            input.discountPct > 0
              ? { value: input.discountPct, valueType: 'PERCENTAGE', title: 'RTO Shield prepaid', description: 'Pay now' }
              : undefined,
          note: `rto-source:${input.externalOrderId}`,
          tags: ['rto-shield-prepaid'],
        },
      },
      );
    } catch (error) {
      if (error instanceof ShopifyQueryError) {
        if (/access denied|write_draft_orders|scope/i.test(error.logLine)) {
          throw new BadRequestException('Shopify needs the write_draft_orders scope before a prepaid draft can be created.');
        }
        throw new BadRequestException(error.seller || 'Shopify could not create the prepaid draft.');
      }
      throw error;
    }
    if (!data.draftOrderCreate?.draftOrder?.invoiceUrl) {
      const explained = explainShopify({ userErrors: data.draftOrderCreate?.userErrors || [] });
      throw new BadRequestException(explained.seller || 'Shopify could not create the prepaid draft.');
    }
    return {
      draftGid: data.draftOrderCreate.draftOrder.id || '',
      invoiceUrl: data.draftOrderCreate.draftOrder.invoiceUrl,
      simulated: false,
    };
  }

  async updateShippingAddress(
    user: UserDocument,
    gid: string,
    address: { address1: string; address2?: string; city: string; province: string; zip: string },
    options?: { demoTest?: boolean },
  ) {
    const token = this.tokenFor(user, Boolean(options?.demoTest));
    const shop = user.shopify?.shopDomain;
    if (!token || !shop || !gid) return;
    const shippingAddress = shopifyShippingAddress(address);
    if (!shippingAddress) {
      throw new ShopifyQueryError('This state has no Shopify province code.', `missing provinceCode for ${address.province || 'state'}`);
    }
    const data = await this.graphql<{ orderUpdate?: { userErrors?: ShopifyUserError[] | null } }>(
      shop,
      token,
      `mutation($input: OrderInput!) { orderUpdate(input: $input) { userErrors { field message } } }`,
      { input: { id: gid, shippingAddress } },
    );
    const failures = (data.orderUpdate?.userErrors || []).filter((item) => item?.message || item?.field || item?.code);
    if (failures.length) {
      const explained = explainShopify({ userErrors: failures });
      throw new ShopifyQueryError(explained.seller, explained.log);
    }
  }

  async notePrepaidPaid(user: UserDocument, body: Record<string, unknown>) {
    const note = String(body.note || '');
    const match = note.match(/rto-source:(\S+)/);
    const sourceId = match?.[1];
    if (!sourceId) return;
    const order = await this.orders.findOne({ sellerId: user._id, externalOrderId: sourceId });
    if (!order || order.outcome === 'converted') return;
    const paidGid = String(body.admin_graphql_api_id || (body.id ? `gid://shopify/Order/${body.id}` : ''));
    const token = this.tokenOf(user);
    const shop = user.shopify?.shopDomain;
    if (token && shop && order.shopifyGid && !user.shopify?.demo) {
      try {
        await this.graphql(
          shop,
          token,
          `mutation($orderId: ID!, $reason: OrderCancelReason!, $refund: Boolean!, $restock: Boolean!, $notifyCustomer: Boolean, $staffNote: String) {
            orderCancel(orderId: $orderId, reason: $reason, refund: $refund, restock: $restock, notifyCustomer: $notifyCustomer, staffNote: $staffNote) {
              userErrors { message }
            }
          }`,
          {
            orderId: order.shopifyGid,
            reason: 'CUSTOMER',
            refund: false,
            restock: true,
            notifyCustomer: false,
            staffNote: 'RTO Shield: buyer paid the prepaid invoice. Original cash on delivery order cancelled.',
          },
        );
        await this.graphql(shop, token, `mutation($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { message } } }`, {
          id: order.shopifyGid,
          tags: ['rto-shield-converted'],
        });
      } catch (error) {
        this.warnShopify('Prepaid conversion missed', error);
      }
    }
    order.outcome = 'converted';
    order.stage = 'closed';
    order.prepaid = {
      draftGid: order.prepaid?.draftGid || '',
      invoiceUrl: order.prepaid?.invoiceUrl || '',
      discountPct: order.prepaid?.discountPct || 0,
      status: 'converted',
      linkedOrderId: paidGid,
      offeredAt: order.prepaid?.offeredAt || new Date().toISOString(),
      expiresAt: order.prepaid?.expiresAt || '',
    };
    order.timeline = pushTimeline(order.timeline, 'converted', 'Buyer paid the prepaid draft. Original cash on delivery order cancelled.');
    await order.save();
    await this.audit.create({ sellerId: user._id, action: 'shopify.converted', orderId: String(order._id), meta: { linked: Boolean(paidGid) } });
  }

  private warnShopify(label: string, error: unknown) {
    const detail = shopifyFailure(error);
    this.logger.warn(`${label}: ${detail.log}`);
    return detail;
  }

  private async graphql<T>(shop: string, token: string, query: string, variables: Record<string, unknown>): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-shopify-access-token': token },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(25_000),
      });
    } catch (error) {
      const explained = explainShopify({ errors: error instanceof Error ? error.message : 'Shopify did not answer' });
      throw new ShopifyQueryError(explained.seller, explained.log);
    }
    const body = await readGraphqlBody(response);
    if (!response.ok || hasGraphqlErrors(body.errors)) {
      const explained = explainShopify({
        status: response.ok ? undefined : response.status,
        errors: hasGraphqlErrors(body.errors) ? body.errors : undefined,
      });
      throw new ShopifyQueryError(explained.seller, explained.log);
    }
    const userErrors = blockingUserErrors(body.data);
    if (userErrors.length) {
      const explained = explainShopify({ userErrors });
      throw new ShopifyQueryError(explained.seller, explained.log);
    }
    return (body.data || {}) as T;
  }

  private assertOwner(user: UserDocument) {
    if (effectiveRole(user) !== 'owner') throw new BadRequestException('Only the shop owner can change connections');
  }
}

async function readGraphqlBody(response: Response): Promise<{ data?: unknown; errors?: unknown }> {
  const text = await response.text();
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as { data?: unknown; errors?: unknown };
  } catch {
    return {};
  }
}
