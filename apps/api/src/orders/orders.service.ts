import { BadRequestException, forwardRef, HttpException, Inject, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  cell,
  detectPreset,
  GENERIC_TEMPLATE,
  headersOf,
  parseCount,
  parseCsv,
  parseMoney,
  parseOrderDate,
  parseOutcome,
  parsePayment,
  suggestMapping,
  toCsv,
} from '../common/csv';
import { CryptoService } from '../common/crypto.service';
import { VaultService } from '../common/vault.service';
import { hourInKolkata } from '../common/hour';
import { assertSafeVoiceScript, templateMessage, type DraftMessage } from '../common/messages';
import { maskPhone, whatsappNumber } from '../common/phone';
import { generateSample } from '../common/sample';
import type { ColumnMapping, ImportInput, ManualOrderInput } from '../common/validation';
import { ModelRun } from '../database/model-run.schema';
import { Order, type OrderDocument } from '../database/order.schema';
import { User, type UserDocument } from '../database/user.schema';
import { geminiCallFor } from '../ml/gemini-call';
import { MlService, type GeminiCall } from '../ml/ml.service';
import { DemoService } from '../demo/demo.service';
import { whatsappAllowlist } from '../demo/demo-send';
import { demoSendCap, effectiveRole, isOfficialDemoAccount } from '../demo/demo.policy';
import { ShopifyService } from '../shopify/shopify.service';
import { ElevenLabsService } from '../voice/elevenlabs.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { sessionOpen } from '../whatsapp/whatsapp-templates';
import { buyerReplied, chooseIntervention, pushTimeline, reductionSettings } from './action';
import {
  askGeminiForAddress,
  fetchIndiaPost,
  matchPostOffices,
  stripReplyPhones,
  type ParsedAddress,
} from './address-intake';
import { toMlOrder } from '../ml/payload';
import type { AddressQuality, PredictResponse, Prediction } from '../ml/ml.types';
import {
  DEMO_FAST_HISTORY,
  DEMO_FAST_TIMEOUT_MS,
  DEMO_HISTORY_ROWS,
  DEMO_PENDING_ROWS,
  scoreWithRules,
  type PreparedSampleOrder,
} from './rules-score';
import { buyerSignal, phoneLedger, pinLedger, pinSignal } from './shop-signals';

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersService.name);
  private readonly upgrading = new Set<string>();
  private readonly crediting = new Set<string>();
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(ModelRun.name) private readonly runs: Model<ModelRun>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly crypto: CryptoService,
    private readonly vault: VaultService,
    private readonly ml: MlService,
    @Inject(forwardRef(() => ShopifyService)) private readonly shopify: ShopifyService,
    @Inject(forwardRef(() => ElevenLabsService)) private readonly calls: ElevenLabsService,
    @Inject(forwardRef(() => WhatsAppService)) private readonly whatsapp: WhatsAppService,
    private readonly demo: DemoService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.sweepTimer = setInterval(() => {
      void this.sweepEscalations().catch((error: unknown) => {
        this.logger.warn(`Escalation sweep missed: ${error instanceof Error ? error.name : 'error'}`);
      });
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  template() {
    return GENERIC_TEMPLATE;
  }

  preview(csv: string) {
    const rows = parseCsv(csv);
    const headers = headersOf(rows);
    const preset = detectPreset(headers);
    return {
      headers,
      preset,
      suggestedMapping: suggestMapping(headers, preset),
      sampleRows: rows.slice(0, 5),
      rowCount: rows.length,
    };
  }

  async importCsv(user: UserDocument, input: ImportInput) {
    const rows = parseCsv(input.csv);
    const existing = await this.orders.find({ sellerId: user._id }).select('externalOrderId').lean();
    const seen = new Set(existing.map((row) => row.externalOrderId));
    const docs: Array<Record<string, unknown>> = [];
    let skipped = 0;
    const errors: string[] = [];
    rows.forEach((row, index) => {
      const built = this.fromCsvRow(user, row, input.mapping, input.mode, input.source || 'generic', index + 2);
      if ('error' in built) {
        skipped += 1;
        if (errors.length < 8) errors.push(built.error);
        return;
      }
      if (seen.has(built.doc.externalOrderId as string)) {
        skipped += 1;
        if (errors.length < 8) errors.push(`Row ${index + 2}: duplicate order id`);
        return;
      }
      seen.add(built.doc.externalOrderId as string);
      docs.push(built.doc);
    });
    if (docs.length) await this.orders.insertMany(docs);
    return { inserted: docs.length, skipped, errors };
  }

  async createManual(user: UserDocument, input: ManualOrderInput) {
    const externalOrderId = input.externalOrderId?.trim() || `M-${Date.now()}`;
    const exists = await this.orders.exists({ sellerId: user._id, externalOrderId });
    if (exists) throw new BadRequestException('An order with that id already exists');
    const orderedAt = input.orderedAt ? parseOrderDate(input.orderedAt) : new Date();
    const doc = await this.orders.create(
      this.encryptFields(user, {
        externalOrderId,
        buyerName: input.buyerName,
        phone: input.phone,
        address: input.address,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        orderValue: input.orderValue,
        paymentType: input.paymentType,
        orderedAt,
        hour: hourInKolkata(orderedAt),
        priorOrders: input.priorOrders,
        priorRtos: Math.min(input.priorRtos, input.priorOrders),
        productName: input.productName,
        courier: input.courier,
        stage: 'pending',
        outcome: null,
        source: 'manual',
      }),
    );
    return this.toDetail(user, doc);
  }

  async loadSample(user: UserDocument) {
    const live = Boolean(user.shopify && !user.shopify.demo && !user.shopify.uninstalledAt && (user.shopify.tokenEnvelope || user.shopify.shopDomain));
    if (live && user.shopify?.tokenEnvelope) {
      throw new BadRequestException('Sample data stays off a shop that is connected to Shopify.');
    }
    await this.orders.deleteMany({ sellerId: user._id, source: 'sample' });
    const generated = generateSample();
    const docs = generated.map((order) =>
      this.encryptFields(user, {
        ...order,
        hour: hourInKolkata(order.orderedAt),
        source: 'sample' as const,
      }),
    );
    await this.orders.insertMany(docs);
    const history = generated.filter((order) => order.stage === 'history').length;
    const pending = generated.length - history;
    return {
      history,
      pending,
      notice: 'Synthetic buyers only. Delete them from Settings before you upload real orders.',
    };
  }

  /**
   * Score and encrypt the canonical demo set before the account exists.
   * The fast model sees a short history and a 1.5s budget. Encryption runs
   * beside that call. If the model is cold or slow, local rules still fill
   * every pending order so the shop never opens empty.
   */
  async stageDemo(): Promise<{
    orders: PreparedSampleOrder[];
    secrets: Array<{ buyerNameEnc: string; phoneEnc: string; phoneMasked: string; addressEnc: string }>;
    score: PredictResponse;
    mlMs: number;
    encryptMs: number;
  }> {
    const orders = generateSample(42, DEMO_HISTORY_ROWS, DEMO_PENDING_ROWS).map((order) => ({
      ...order,
      hour: hourInKolkata(order.orderedAt),
    }));
    const mlStarted = Date.now();
    const scorePromise = this.demoScore(orders);
    const encryptStarted = Date.now();
    const secrets = this.encryptSampleSecrets(orders);
    const encryptMs = Date.now() - encryptStarted;
    const score = await scorePromise;
    return { orders, secrets, score, mlMs: Date.now() - mlStarted, encryptMs };
  }

  async persistDemo(
    user: UserDocument,
    staged: {
      orders: PreparedSampleOrder[];
      secrets: Array<{ buyerNameEnc: string; phoneEnc: string; phoneMasked: string; addressEnc: string }>;
      score: PredictResponse;
    },
  ) {
    await this.orders.deleteMany({ sellerId: user._id, source: 'sample' });
    const byId = new Map(staged.score.predictions.map((row) => [row.id, row]));
    const docs = staged.orders.map((order, index) => {
      const secret = staged.secrets[index]!;
      const base = {
        sellerId: user._id,
        externalOrderId: order.externalOrderId,
        buyerNameEnc: secret.buyerNameEnc,
        phoneEnc: secret.phoneEnc,
        phoneMasked: secret.phoneMasked,
        addressEnc: secret.addressEnc,
        city: order.city,
        state: order.state,
        pincode: order.pincode,
        orderValue: order.orderValue,
        paymentType: order.paymentType,
        orderedAt: order.orderedAt,
        hour: order.hour,
        priorOrders: order.priorOrders,
        priorRtos: order.priorRtos,
        productName: order.productName,
        courier: order.courier,
        stage: order.stage,
        outcome: order.outcome,
        source: 'sample' as const,
        riskScore: null as number | null,
        riskBand: null as 'Low' | 'Medium' | 'High' | null,
        reasons: [] as string[],
        addressQuality: null as Record<string, unknown> | null,
        messages: null,
        predictor: null as string | null,
      };
      if (order.stage !== 'pending') return base;
      const prediction = byId.get(order.externalOrderId);
      if (!prediction) return base;
      return { ...base, ...this.scoredFields(user, order, prediction, staged.score.model) };
    });
    if (docs.length) {
      const now = new Date();
      await this.orders.collection.insertMany(
        docs.map((doc) => ({ ...doc, createdAt: now, updatedAt: now })),
        { ordered: false },
      );
    }
    await this.runs.create({
      sellerId: user._id,
      model: staged.score.model,
      modelLabel: staged.score.model_label,
      metrics: staged.score.metrics,
      addressSource: staged.score.address_source,
      warnings: staged.score.warnings,
    });
    const scored = docs.filter((doc) => doc.riskScore !== null && doc.stage === 'pending').length;
    this.startUpgrade(user);
    return {
      scored,
      notice: scored ? null : 'Sample orders are in the shop. Score them once the model is awake.',
      upgrading: true,
    };
  }

  private async demoScore(orders: PreparedSampleOrder[]): Promise<PredictResponse> {
    const history = orders.filter((order) => order.stage === 'history').slice(-DEMO_FAST_HISTORY);
    const pending = orders.filter((order) => order.stage === 'pending');
    const pins = pinLedger(orders.filter((order) => order.stage === 'history'));
    const phones = phoneLedger(orders.filter((order) => order.stage === 'history'));
    const toPayload = (order: PreparedSampleOrder) => {
      const buyer = buyerSignal(phones, order.phone, order.priorOrders, order.priorRtos);
      const pin = pinSignal(pins, order.pincode);
      return toMlOrder({
        id: order.externalOrderId,
        orderValue: order.orderValue,
        paymentType: order.paymentType,
        hour: order.hour,
        priorOrders: buyer.priorOrders,
        priorRtos: buyer.priorRtos,
        address: order.address,
        city: order.city,
        state: order.state,
        pincode: order.pincode,
        outcome: order.outcome,
        sellerPinN: pin.sellerPinN,
        sellerPinRtoRate: pin.sellerPinRtoRate,
      });
    };
    try {
      const score = await this.ml.predict(history.map(toPayload), pending.map(toPayload), {
        speed: 'fast',
        timeoutMs: DEMO_FAST_TIMEOUT_MS,
      });
      if (score.predictions.length < pending.length) throw new Error('incomplete demo score');
      return score;
    } catch (error) {
      this.logger.warn(`Demo fast score missed: ${error instanceof Error ? error.name : 'error'}`);
      return scoreWithRules(orders);
    }
  }

  private encryptSampleSecrets(orders: PreparedSampleOrder[]) {
    return orders.map((order) => ({
      buyerNameEnc: this.crypto.encrypt(order.buyerName),
      phoneEnc: this.crypto.encrypt(order.phone),
      phoneMasked: maskPhone(order.phone),
      addressEnc: this.crypto.encrypt(order.address),
    }));
  }

  async list(
    user: UserDocument,
    query: { stage?: string; outcome?: string; q?: string; limit: number; offset: number },
  ) {
    const filter: Record<string, unknown> = { sellerId: user._id };
    if (query.stage) filter.stage = query.stage;
    if (query.outcome) filter.outcome = query.outcome;
    const needle = (query.q || '').trim().slice(0, 80);
    if (needle) {
      const safe = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { externalOrderId: { $regex: safe, $options: 'i' } },
        { city: { $regex: safe, $options: 'i' } },
        { pincode: { $regex: safe, $options: 'i' } },
        { productName: { $regex: safe, $options: 'i' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.orders
        .find(filter)
        .sort(query.stage === 'pending' ? { riskScore: -1, orderedAt: -1 } : { orderedAt: -1 })
        .skip(query.offset)
        .limit(query.limit),
      this.orders.countDocuments(filter),
    ]);
    return { total, orders: items.map((order) => this.toList(order)) };
  }

  async getOne(user: UserDocument, id: string) {
    const order = await this.findOwned(user, id);
    return this.toDetail(user, order);
  }

  async queue(user: UserDocument, scope: 'action' | 'open' = 'action') {
    const filter: Record<string, unknown> = scope === 'open'
      ? { sellerId: user._id, stage: 'pending' }
      : {
          sellerId: user._id,
          $or: [
            { stage: 'pending', intervention: 'hold_review' },
            { whatsappStatus: 'failed' },
            { exception: { $in: ['address', 'template_pending', 'send', 'call', 'shopify'] } },
            { stage: 'pending', callState: 'due' },
          ],
        };
    const items = await this.orders.find(filter).sort({ riskScore: -1, orderedAt: -1 }).limit(200);
    return { orders: items.map((order) => this.toDetail(user, order)) };
  }

  /**
   * Demo shops open with orders and no buyer replies, so Results stays at ₹0.
   * Walk open orders once: sample rows for an isolated demo, otherwise the official
   * demo shop's open Shopify orders. Validate a few addresses with India Post,
   * record prepaid conversions, confirmations, and holds. A stamp stops a second pass.
   * Real shops never enter.
   */
  async creditDemoOutcomes(user: UserDocument) {
    const shopifyDemo = Boolean(user.shopify?.demo || isOfficialDemoAccount(user.email));
    if (!user.isDemo && !shopifyDemo) return;
    const id = String(user._id);
    if (this.crediting.has(id)) return;
    this.crediting.add(id);
    try {
      if (await this.demo.outcomeStamp(user)) return;
      const sample = await this.orders.countDocuments({ sellerId: user._id, source: 'sample' });
      const source = sample > 0 ? 'sample' : 'shopify';
      if (source === 'shopify' && !shopifyDemo) return;
      const pending = await this.orders
        .find({ sellerId: user._id, stage: 'pending', source })
        .sort({ externalOrderId: 1 })
        .limit(40);
      if (!pending.length) return;
      const counts = { conversions: 0, confirmations: 0, addressFixes: 0, holds: 0 };
      const offices = new Map<string, Awaited<ReturnType<typeof fetchIndiaPost>> | null>();
      const lookup = async (pin: string) => {
        if (offices.has(pin)) return offices.get(pin) || [];
        if (offices.size >= 4) return [];
        try {
          const rows = await fetchIndiaPost(pin, fetch, 2_500);
          offices.set(pin, rows);
          return rows;
        } catch {
          offices.set(pin, null);
          return [];
        }
      };
      const writeOutcome = async (order: OrderDocument, fields: Record<string, unknown>) => {
        const written = await this.orders.updateOne(
          { _id: order._id, sellerId: user._id, stage: 'pending' },
          { $set: fields },
        );
        return written.modifiedCount > 0;
      };
      for (let index = 0; index < pending.length; index += 1) {
        const order = pending[index]!;
        const bucket = index % 4;
        if (bucket === 0) {
          const parsed: ParsedAddress = {
            street: 'Lane 4, Shastri Nagar',
            landmark: '',
            city: order.city || '',
            state: order.state || '',
            pin: order.pincode || '',
          };
          const matched = matchPostOffices(parsed, await lookup(parsed.pin));
          if (!matched.ok) continue;
          const line = [matched.address.street, matched.address.landmark].filter(Boolean).join(', ').slice(0, 300);
          const saved = await writeOutcome(order, {
            addressEnc: this.crypto.encrypt(line || matched.address.street),
            city: matched.address.city || order.city,
            state: matched.address.state || order.state,
            pincode: matched.address.pin || order.pincode,
            addressDraft: matched.address,
            addressFixedAt: new Date(),
            timeline: pushTimeline(order.timeline, 'address', 'Address checked against India Post and saved.'),
          });
          if (saved) counts.addressFixes += 1;
          continue;
        }
        if (bucket === 1 && order.paymentType === 'cod') {
          const now = new Date().toISOString();
          const saved = await writeOutcome(order, {
            outcome: 'converted',
            stage: 'closed',
            intervention: 'offer_prepaid',
            prepaid: {
              draftGid: '',
              invoiceUrl: '',
              discountPct: reductionSettings(user).discountPct,
              status: 'converted',
              linkedOrderId: '',
              offeredAt: now,
              expiresAt: now,
            },
            timeline: pushTimeline(order.timeline, 'converted', 'Buyer paid the prepaid link.'),
          });
          if (saved) counts.conversions += 1;
          continue;
        }
        if (bucket === 2 || bucket === 1) {
          const saved = await writeOutcome(order, {
            outcome: 'confirmed',
            stage: 'closed',
            timeline: pushTimeline(order.timeline, 'confirmed', 'Buyer confirmed the order.'),
          });
          if (saved) counts.confirmations += 1;
          continue;
        }
        const saved = await writeOutcome(order, {
          intervention: 'hold_review',
          interventionWhy: 'Held for the seller.',
          timeline: pushTimeline(order.timeline, 'hold', 'Held for the seller.'),
        });
        if (saved) counts.holds += 1;
      }
      await this.demo.stampOutcomes(user, counts);
    } catch (error) {
      this.logger.warn(`Demo outcomes missed: ${error instanceof Error ? error.name : 'error'}`);
    } finally {
      this.crediting.delete(id);
    }
  }

  async activity(user: UserDocument) {
    await this.creditDemoOutcomes(user);
    const items = await this.orders.find({ sellerId: user._id, 'timeline.0': { $exists: true } }).sort({ updatedAt: -1 }).limit(40);
    const events = items.flatMap((order) => (order.timeline || []).map((step) => ({
      at: step.at,
      step: step.step,
      detail: step.detail,
      orderId: String(order._id),
      externalOrderId: order.externalOrderId,
    })));
    events.sort((a, b) => (a.at < b.at ? 1 : -1));
    return { events: events.slice(0, 80) };
  }

  async payTarget(token: string) {
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(token)) return { url: '', discountPct: 0 };
    const order = await this.orders.findOne({ 'prepaid.payToken': token }).select('prepaid.invoiceUrl prepaid.discountPct');
    const invoice = order?.prepaid?.invoiceUrl || '';
    const url = invoice.startsWith('https://') && !invoice.includes('/pay/') ? invoice : '';
    return { url, discountPct: order?.prepaid?.discountPct ?? 0 };
  }

  async markOutcome(user: UserDocument, id: string, outcome: 'confirmed' | 'cancelled' | 'no_response') {
    const order = await this.findOwned(user, id);
    if (order.stage !== 'pending') return this.toDetail(user, order);
    await this.demo.capture(user, [order]);
    order.outcome = outcome;
    order.stage = 'closed';
    order.timeline = pushTimeline(order.timeline, outcome, `Seller marked ${outcome.replace('_', ' ')}`);
    await order.save();
    if (effectiveRole(user) === 'demo') await this.demo.note(user, 'demo.outcome', String(order._id), { outcome });
    return this.toDetail(user, order);
  }

  isUpgrading(userId: string) {
    return this.upgrading.has(userId);
  }

  /**
   * Fast scores return to the shop. Demo landing trains scikit-learn only.
   * An explicit Score also starts TabPFN afterwards.
   */
  startUpgrade(user: UserDocument, options?: { full?: boolean }) {
    const id = String(user._id);
    if (this.upgrading.has(id)) return;
    this.upgrading.add(id);
    const full = options?.full === true;
    setImmediate(() => {
      void this.runUpgrade(user, full).finally(() => this.upgrading.delete(id));
    });
  }

  private async runUpgrade(user: UserDocument, full: boolean) {
    try {
      if (full) {
        const latest = await this.latestModel(user);
        if (!latest || latest.model === 'rules-prior') {
          await this.score(user, { fast: true, timeoutMs: 20_000, historyLimit: 120 });
        }
        await this.score(user, { fast: false, timeoutMs: 55_000, address: 'heuristic' });
      } else {
        // Demo landing trains one scikit-learn pass on a stable history slice, then asks Gemma for notes.
        await this.score(user, { fast: true, timeoutMs: 40_000, historyLimit: 120, address: 'heuristic' });
      }
      await this.refreshGemma(user);
    } catch (error) {
      this.logger.warn(`Background score stopped: ${error instanceof Error ? error.name : 'error'}`);
    }
  }

  /** Address notes and confirmation drafts. Scores already on the order stay put. */
  private geminiCall(user: UserDocument): GeminiCall | undefined {
    return geminiCallFor(user, (envelope) => this.vault.open(envelope));
  }

  private async refreshGemma(user: UserDocument) {
    try {
      const gemini = this.geminiCall(user);
      if (gemini?.mode === 'seller' && !gemini.key) {
        this.logger.warn('Gemma skipped: the saved Gemini key could not be opened');
        return;
      }
      // No saved key uses the platform Gemini key on the ML service, capped so one shop cannot drain it.
      const platform = !gemini;
      const noteCap = platform ? 24 : 80;
      const draftCap = platform ? 12 : 48;
      if (platform) this.logger.log('Address notes and drafts: platform Gemini');
      const pending = await this.orders.find({ sellerId: user._id, stage: 'pending' }).limit(noteCap);
      if (!pending.length) return;
      // One batch per request so a rate limit on a later batch still keeps the notes already written.
      const notes = new Map<string, AddressQuality>();
      for (let index = 0; index < pending.length; index += 8) {
        const slice = pending.slice(index, index + 8);
        try {
          const noted = await this.ml.addressNotes(
            slice.map((order) => ({
              id: String(order._id),
              address: this.crypto.decrypt(order.addressEnc),
              city: order.city,
              state: order.state,
              pincode: order.pincode,
            })),
            gemini,
          );
          for (const row of noted.addresses) notes.set(row.id, row.address_quality);
          this.logger.log(`Address notes engine: ${noted.source}`);
          if (noted.source !== 'gemini' && noted.source !== 'ollama') {
            this.logger.warn('Address notes used order facts. Gemini did not answer.');
          }
        } catch (error) {
          this.logger.warn(`Gemma address batch missed: ${error instanceof Error ? error.name : 'error'}`);
        }
      }
      const risky = pending.filter((order) => order.riskBand === 'High' || order.riskBand === 'Medium').slice(0, draftCap);
      const drafts = new Map<string, DraftMessage>();
      for (let index = 0; index < risky.length; index += 6) {
        const slice = risky.slice(index, index + 6);
        try {
          const generated = await this.ml.messages(
            user.shopName,
            slice.map((order) => ({
              id: String(order._id),
              first_name: this.firstName(order),
              order_value: order.orderValue,
              product_name: order.productName || 'order',
              payment_type: order.paymentType,
            })),
            gemini,
          );
          this.logger.log(`Confirmation drafts engine: ${generated.source}`);
          if (generated.source !== 'gemini' && generated.source !== 'ollama') {
            this.logger.warn('Confirmation drafts used the built-in template. Gemini did not answer.');
          }
          for (const message of generated.messages) {
            if (message.source === 'gemini' || message.source === 'ollama') drafts.set(message.id, message);
          }
        } catch (error) {
          this.logger.warn(`Gemma draft batch missed: ${error instanceof Error ? error.name : 'error'}`);
        }
      }
      const now = new Date();
      const writes = [];
      for (const order of pending) {
        const quality = notes.get(String(order._id));
        const draft = drafts.get(String(order._id));
        const $set: Record<string, unknown> = {};
        if (quality && (quality.source === 'gemini' || quality.source === 'ollama')) $set.addressQuality = quality;
        if (draft) {
          draft.voice_script_hi = assertSafeVoiceScript(draft.voice_script_hi, user.shopName, order.orderValue);
          $set.messages = draft;
        }
        if (!Object.keys($set).length) continue;
        $set.updatedAt = now;
        writes.push({
          updateOne: {
            filter: { _id: order._id, sellerId: user._id },
            update: { $set },
          },
        });
      }
      if (writes.length) await this.orders.bulkWrite(writes, { ordered: false });
    } catch (error) {
      this.logger.warn(`Gemma notes missed: ${error instanceof Error ? error.name : 'error'}`);
    }
  }

  async score(user: UserDocument, options?: {
    fast?: boolean;
    timeoutMs?: number;
    historyLimit?: number;
    address?: 'heuristic' | 'auto' | 'gemma';
  }) {
    const pending = await this.orders.find({ sellerId: user._id, stage: 'pending' }).limit(500);
    if (effectiveRole(user) === 'demo') await this.demo.capture(user, pending);
    if (!pending.length) {
      const latest = await this.latestModel(user);
      return { scored: 0, message: 'No pending orders to score.', model: latest };
    }
    const fast = options?.fast === true;
    // The button waits on a short history. Background training can ask for more.
    const historyLimit = options?.historyLimit ?? (fast ? 48 : 5000);
    const history = await this.orders
      .find({
        sellerId: user._id,
        outcome: { $in: ['delivered', 'rto', 'cancelled'] },
      })
      .sort({ orderedAt: -1 })
      .limit(historyLimit);

    const labelled = history.map((order) => ({
      pincode: order.pincode,
      outcome: order.outcome,
      phone: this.crypto.decrypt(order.phoneEnc),
    }));
    const pins = pinLedger(labelled);
    const phones = phoneLedger(labelled);
    const signalFor = (order: OrderDocument) => {
      const buyer = buyerSignal(phones, this.crypto.decrypt(order.phoneEnc), order.priorOrders, order.priorRtos);
      const pin = pinSignal(pins, order.pincode);
      return { ...buyer, ...pin };
    };
    const historyPayload = history.map((order) => {
      const signal = signalFor(order);
      return toMlOrder({
        id: String(order._id),
        orderValue: order.orderValue,
        paymentType: order.paymentType,
        hour: order.hour,
        priorOrders: order.priorOrders,
        priorRtos: order.priorRtos,
        address: this.crypto.decrypt(order.addressEnc),
        city: order.city,
        state: order.state,
        pincode: order.pincode,
        outcome: order.outcome,
        sellerPinN: signal.sellerPinN,
        sellerPinRtoRate: signal.sellerPinRtoRate,
      });
    });
    const pendingPayload = pending.map((order) => {
      const signal = signalFor(order);
      return toMlOrder({
        id: String(order._id),
        orderValue: order.orderValue,
        paymentType: order.paymentType,
        hour: order.hour,
        priorOrders: signal.priorOrders,
        priorRtos: signal.priorRtos,
        address: this.crypto.decrypt(order.addressEnc),
        city: order.city,
        state: order.state,
        pincode: order.pincode,
        outcome: null,
        sellerPinN: signal.sellerPinN,
        sellerPinRtoRate: signal.sellerPinRtoRate,
      });
    });

    let result: PredictResponse;
    try {
      const address = options?.address ?? 'heuristic';
      result = await this.ml.predict(historyPayload, pendingPayload, {
        speed: fast ? 'fast' : 'full',
        timeoutMs: options?.timeoutMs ?? (fast ? 9_000 : 55_000),
        address,
        gemini: address === 'heuristic' ? undefined : this.geminiCall(user),
      });
    } catch (error) {
      if (!fast) throw error;
      this.logger.warn(`Fast score missed: ${error instanceof Error ? error.name : 'error'}`);
      const prepared: PreparedSampleOrder[] = [...history, ...pending].map((order) => {
        const signal = signalFor(order);
        return {
          externalOrderId: String(order._id),
          buyerName: '',
          phone: this.crypto.decrypt(order.phoneEnc),
          address: this.crypto.decrypt(order.addressEnc),
          city: order.city,
          state: order.state,
          pincode: order.pincode,
          orderValue: order.orderValue,
          paymentType: order.paymentType,
          orderedAt: order.orderedAt,
          hour: order.hour,
          priorOrders: signal.priorOrders,
          priorRtos: signal.priorRtos,
          productName: order.productName,
          courier: order.courier,
          stage: order.stage === 'pending' ? 'pending' : 'history',
          outcome:
            order.outcome === 'rto' || order.outcome === 'cancelled'
              ? 'rto'
              : order.outcome === 'delivered'
                ? 'delivered'
                : null,
        };
      });
      result = scoreWithRules(prepared);
    }
    const byId = new Map(result.predictions.map((row) => [row.id, row]));
    // Templates land with the score. Gemma replaces notes and drafts afterwards, off this timer.
    const now = new Date();
    const writes: Array<{ updateOne: { filter: { _id: OrderDocument['_id']; sellerId: UserDocument['_id']; stage: 'pending' }; update: { $set: Record<string, unknown> } } }> = [];
    for (const order of pending) {
      const prediction = byId.get(String(order._id));
      if (!prediction) continue;
      order.riskScore = prediction.score;
      order.riskBand = prediction.band;
      order.reasons = prediction.reasons;
      order.addressQuality = prediction.address_quality as unknown as Record<string, unknown>;
      order.predictor = result.model;
      if (prediction.band === 'High' || prediction.band === 'Medium') {
        const draft = templateMessage(user.shopName, this.firstName(order), order.orderValue, order.productName);
        draft.voice_script_hi = assertSafeVoiceScript(draft.voice_script_hi, user.shopName, order.orderValue);
        order.messages = draft;
      }
      const choice = chooseIntervention({
        paymentType: order.paymentType,
        riskScore: prediction.score,
        riskBand: prediction.band,
        reasons: prediction.reasons,
        priorRtos: order.priorRtos,
        addressQuality: prediction.address_quality,
        settings: reductionSettings(user),
      });
      order.intervention = choice.action;
      order.interventionWhy = choice.why;
      const timeline = [...(order.timeline || [])];
      const already = timeline.some((step) => step.step === 'action' || step.step === 'auto_confirm');
      if (choice.action === 'auto_confirm' && order.stage === 'pending' && !order.outcome) {
        order.outcome = 'confirmed';
        order.stage = 'closed';
        timeline.push({ at: now.toISOString(), step: 'auto_confirm', detail: choice.why });
      } else if (!already) {
        timeline.push({ at: now.toISOString(), step: 'action', detail: choice.why });
      }
      order.timeline = timeline;
      writes.push({
        updateOne: {
          filter: { _id: order._id, sellerId: user._id, stage: 'pending' },
          update: {
            $set: {
              riskScore: order.riskScore,
              riskBand: order.riskBand,
              reasons: order.reasons,
              addressQuality: order.addressQuality,
              messages: order.messages,
              predictor: order.predictor,
              intervention: order.intervention,
              interventionWhy: order.interventionWhy,
              timeline: order.timeline,
              stage: order.stage,
              outcome: order.outcome,
              updatedAt: now,
            },
          },
        },
      });
    }
    if (writes.length) await this.orders.bulkWrite(writes, { ordered: false });
    this.writeShopify(user, pending);
    if (reductionSettings(user).autopilot) {
      await this.runAutopilot(user, pending);
    }

    if (effectiveRole(user) === 'demo') {
      await this.demo.note(user, 'demo.score', '', { scored: result.predictions.length });
    }

    await this.runs.create({
      sellerId: user._id,
      model: result.model,
      modelLabel: result.model_label,
      metrics: result.metrics,
      addressSource: result.address_source,
      warnings: result.warnings,
    });

    return {
      scored: result.predictions.length,
      model: result.model,
      modelLabel: result.model_label,
      metrics: result.metrics,
      addressSource: result.address_source,
      warnings: result.warnings,
      orders: pending.map((order) => this.toList(order)),
    };
  }

  async latestModel(user: UserDocument) {
    const run = await this.runs.findOne({ sellerId: user._id }).sort({ createdAt: -1 }).lean();
    if (!run) return null;
    return {
      model: run.model,
      modelLabel: run.modelLabel,
      metrics: run.metrics,
      addressSource: run.addressSource,
      warnings: run.warnings,
      createdAt: (run as { createdAt?: Date }).createdAt ?? null,
    };
  }

  async exportCsv(user: UserDocument) {
    const items = await this.orders.find({ sellerId: user._id }).sort({ orderedAt: -1 }).limit(15000);
    const headers = [
      'order_id',
      'buyer_name',
      'phone',
      'address',
      'city',
      'state',
      'pincode',
      'order_value',
      'payment_type',
      'ordered_at',
      'prior_orders',
      'prior_rtos',
      'outcome',
      'stage',
      'risk_score',
      'risk_band',
      'reasons',
      'product_name',
      'courier',
      'source',
    ];
    const rows = items.map((order) => [
      order.externalOrderId,
      this.crypto.decrypt(order.buyerNameEnc),
      this.crypto.decrypt(order.phoneEnc),
      this.crypto.decrypt(order.addressEnc),
      order.city,
      order.state,
      order.pincode,
      order.orderValue,
      order.paymentType,
      order.orderedAt.toISOString(),
      order.priorOrders,
      order.priorRtos,
      order.outcome ?? '',
      order.stage,
      order.riskScore ?? '',
      order.riskBand ?? '',
      order.reasons.join(' | '),
      order.productName,
      order.courier,
      order.source,
    ]);
    return toCsv(headers, rows);
  }

  private fromCsvRow(
    user: UserDocument,
    row: Record<string, string>,
    mapping: ColumnMapping,
    mode: 'history' | 'pending',
    source: 'shopify' | 'meesho' | 'generic',
    line: number,
  ): { doc: Record<string, unknown> } | { error: string } {
    const externalOrderId = cell(row, mapping.orderId).slice(0, 64);
    const buyerName = cell(row, mapping.buyerName).slice(0, 80);
    const phone = cell(row, mapping.phone).slice(0, 20);
    const address = cell(row, mapping.address).slice(0, 400);
    const pincode = cell(row, mapping.pincode).replace(/\D/g, '');
    const orderValue = parseMoney(cell(row, mapping.orderValue));
    if (!externalOrderId) return { error: `Row ${line}: missing order id` };
    if (!buyerName) return { error: `Row ${line}: missing buyer name` };
    if (phone.replace(/\D/g, '').length < 10) return { error: `Row ${line}: missing phone` };
    if (!address) return { error: `Row ${line}: missing address` };
    if (!/^[1-9][0-9]{5}$/.test(pincode)) return { error: `Row ${line}: pincode must be 6 digits` };
    if (orderValue === null) return { error: `Row ${line}: missing order value` };
    const outcome = parseOutcome(cell(row, mapping.outcome));
    if (mode === 'history' && !outcome) return { error: `Row ${line}: history needs a delivered or RTO outcome` };
    const orderedAt = parseOrderDate(cell(row, mapping.orderedAt));
    const priorOrders = parseCount(cell(row, mapping.priorOrders));
    const priorRtos = Math.min(priorOrders, parseCount(cell(row, mapping.priorRtos)));
    return {
      doc: this.encryptFields(user, {
        externalOrderId,
        buyerName,
        phone,
        address,
        city: cell(row, mapping.city).slice(0, 80),
        state: cell(row, mapping.state).slice(0, 80),
        pincode,
        orderValue,
        paymentType: parsePayment(cell(row, mapping.paymentType)),
        orderedAt,
        hour: hourInKolkata(orderedAt),
        priorOrders,
        priorRtos,
        productName: cell(row, mapping.productName).slice(0, 80),
        courier: cell(row, mapping.courier).slice(0, 80),
        stage: mode === 'history' ? 'history' : 'pending',
        outcome: mode === 'history' ? outcome : null,
        source,
      }),
    };
  }

  private scoredFields(
    user: UserDocument,
    order: PreparedSampleOrder,
    prediction: Prediction,
    model: string,
  ) {
    const risky = prediction.band === 'High' || prediction.band === 'Medium';
    const draft = risky
      ? templateMessage(user.shopName, order.buyerName.split(/\s+/)[0] || 'ji', order.orderValue, order.productName)
      : null;
    if (draft) draft.voice_script_hi = assertSafeVoiceScript(draft.voice_script_hi, user.shopName, order.orderValue);
    return {
      riskScore: prediction.score,
      riskBand: prediction.band,
      reasons: prediction.reasons,
      addressQuality: prediction.address_quality as unknown as Record<string, unknown>,
      messages: draft,
      predictor: model,
    };
  }

  private encryptFields(
    user: UserDocument,
    input: {
      externalOrderId: string;
      buyerName: string;
      phone: string;
      address: string;
      city: string;
      state: string;
      pincode: string;
      orderValue: number;
      paymentType: 'cod' | 'prepaid';
      orderedAt: Date;
      hour: number;
      priorOrders: number;
      priorRtos: number;
      productName: string;
      courier: string;
      stage: 'history' | 'pending' | 'closed';
      outcome: Order['outcome'];
      source: Order['source'];
    },
  ) {
    return {
      sellerId: user._id,
      externalOrderId: input.externalOrderId,
      buyerNameEnc: this.crypto.encrypt(input.buyerName),
      phoneEnc: this.crypto.encrypt(input.phone),
      phoneMasked: maskPhone(input.phone),
      addressEnc: this.crypto.encrypt(input.address),
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      orderValue: input.orderValue,
      paymentType: input.paymentType,
      orderedAt: input.orderedAt,
      hour: input.hour,
      priorOrders: input.priorOrders,
      priorRtos: input.priorRtos,
      productName: input.productName,
      courier: input.courier,
      stage: input.stage,
      outcome: input.outcome,
      source: input.source,
      riskScore: null,
      riskBand: null,
      reasons: [],
      addressQuality: null,
      messages: null,
      predictor: null,
    };
  }

  private async findOwned(user: UserDocument, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Order not found');
    const order = await this.orders.findOne({ _id: id, sellerId: user._id });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private firstName(order: OrderDocument) {
    const name = this.crypto.decrypt(order.buyerNameEnc);
    return name.split(/\s+/)[0] || 'ji';
  }

  private messageText(user: UserDocument, order: OrderDocument) {
    const messages = order.messages;
    if (!messages) return '';
    if (user.messageLanguage === 'hindi') return messages.hindi;
    if (user.messageLanguage === 'english') return messages.english;
    return messages.hinglish;
  }

  private toList(order: OrderDocument) {
    return {
      id: String(order._id),
      externalOrderId: order.externalOrderId,
      buyerName: this.crypto.decrypt(order.buyerNameEnc),
      phoneMasked: order.phoneMasked,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
      orderValue: order.orderValue,
      paymentType: order.paymentType,
      orderedAt: order.orderedAt,
      hour: order.hour,
      priorOrders: order.priorOrders,
      priorRtos: order.priorRtos,
      productName: order.productName,
      courier: order.courier,
      stage: order.stage,
      outcome: order.outcome,
      source: order.source,
      riskScore: order.riskScore,
      riskBand: order.riskBand,
      reasons: order.reasons,
      addressQuality: order.addressQuality,
      model: order.predictor,
      whatsappStatus: order.whatsappStatus,
      shopifyGid: order.shopifyGid || '',
      intervention: order.intervention,
      interventionWhy: order.interventionWhy || '',
      callState: order.callState || 'idle',
      callDueAt: order.callDueAt,
      addressFixedAt: order.addressFixedAt,
      exception: order.exception,
      exceptionWhy: order.exceptionWhy || '',
      addressReply: this.openText(order.addressReplyEnc),
      addressDraft: order.addressDraft,
      prepaid: order.prepaid
        ? {
            invoiceUrl: order.prepaid.invoiceUrl,
            discountPct: order.prepaid.discountPct,
            status: order.prepaid.status,
            linkedOrderId: order.prepaid.linkedOrderId,
            expiresAt: order.prepaid.expiresAt,
          }
        : null,
    };
  }

  private writeShopify(user: UserDocument, pending: OrderDocument[]) {
    const rows = pending
      .filter((order) => order.shopifyGid && order.riskBand)
      .map((order) => ({ shopifyGid: order.shopifyGid, band: order.riskBand, reasons: order.reasons }));
    if (!rows.length) return;
    void this.shopify.writeRisk(user, rows).catch((error: unknown) => {
      this.logger.warn(`Shopify writeback missed: ${error instanceof Error ? error.name : 'error'}`);
    });
  }

  private toDetail(user: UserDocument, order: OrderDocument) {
    const phone = this.crypto.decrypt(order.phoneEnc);
    const text = this.messageText(user, order);
    const number = whatsappNumber(phone);
    return {
      ...this.toList(order),
      address: this.crypto.decrypt(order.addressEnc),
      messages: order.messages,
      waUrl: number && text ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null,
      conversation: order.conversation || [],
      timeline: order.timeline || [],
    };
  }

  async offerPrepaid(user: UserDocument, id: string) {
    const order = await this.findOwned(user, id);
    const settings = reductionSettings(user);
    if (!settings.prepaidEnabled) throw new BadRequestException('Prepaid offers are off for this shop');
    if (order.paymentType !== 'cod') throw new BadRequestException('This order is already prepaid');
    if (order.prepaid?.status === 'converted') return this.toDetail(user, order);
    const retry = order.exception === 'template_pending' || order.exception === 'send' || order.whatsappStatus === 'failed';
    if (order.prepaid?.status === 'offered' && order.prepaid.payToken && !retry) return this.toDetail(user, order);
    await this.holdDemo(user, ['demo.prepaid'], 'The demo has offered enough prepaid checkouts for today.');
    if (!(order.prepaid?.payToken && order.prepaid.status === 'offered')) {
      const draft = await this.shopify.createPrepaidDraft(user, {
        externalOrderId: order.externalOrderId,
        productName: order.productName,
        orderValue: order.orderValue,
        discountPct: settings.discountPct,
        buyerName: this.crypto.decrypt(order.buyerNameEnc),
        address1: this.crypto.decrypt(order.addressEnc),
        city: order.city,
        province: order.state,
        zip: order.pincode,
      });
      const offeredAt = new Date();
      order.prepaid = {
        draftGid: draft.draftGid,
        invoiceUrl: draft.invoiceUrl,
        discountPct: settings.discountPct,
        status: 'offered',
        linkedOrderId: '',
        offeredAt: offeredAt.toISOString(),
        expiresAt: new Date(offeredAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        payToken: randomBytes(18).toString('base64url'),
      };
      order.intervention = 'offer_prepaid';
      order.interventionWhy = `Prepaid checkout is ready at ${settings.discountPct}% off.`;
      order.timeline = pushTimeline(order.timeline, 'prepaid', draft.simulated ? 'Prepaid link saved on the order.' : 'Shopify draft invoice created.');
      await order.save();
      if (order.shopifyGid) {
        try {
          await this.shopify.tag(user, order.shopifyGid, ['rto-prepaid-offered']);
        } catch (error) {
          this.logger.warn(`Prepaid tag missed: ${error instanceof Error ? error.name : 'error'}`);
        }
      }
    }
    const result = await this.whatsapp.dispatchFlow(user, order, 'payment_link_request');
    await this.noteDispatch(order, result, 'Offered a payment link.');
    const token = order.prepaid?.payToken || '';
    if (result === 'fallback' && token && sessionOpen(order.conversation)) {
      await this.whatsapp.sendSessionLine(user, order, `Pay here: https://www.rtoshield.tech/pay/${token}`);
    }
    if (effectiveRole(user) === 'demo') await this.demo.note(user, 'demo.prepaid', String(order._id), { simulated: result === 'simulated' });
    return this.toDetail(user, order);
  }

  async fixAddress(
    user: UserDocument,
    id: string,
    input: { address?: string; landmark?: string; source: 'reply' | 'call' | 'seller'; useReply?: boolean },
  ) {
    const order = await this.findOwned(user, id);
    await this.holdDemo(user, ['demo.address'], 'The demo has updated enough addresses for today.');
    if (input.useReply) {
      const draft = order.addressDraft;
      if (draft?.street && draft.pin && draft.city && draft.state) {
        await this.writeStructuredAddress(user, order, draft, input.source);
      } else {
        const raw = stripReplyPhones(this.openText(order.addressReplyEnc));
        const pin = raw.match(/\d{6}/)?.[0] || order.pincode;
        let city = order.city;
        let state = order.state;
        try {
          const offices = await fetchIndiaPost(pin);
          if (offices[0]) {
            city = offices[0].District || offices[0].Name || city;
            state = offices[0].State || state;
          }
        } catch (error) {
          this.logger.warn(`India Post missed: ${error instanceof Error ? error.name : 'error'}`);
        }
        const street = raw.replace(/\d{6}/, '').trim() || (input.address || '').trim();
        await this.writeStructuredAddress(user, order, {
          street: street.slice(0, 160),
          landmark: '',
          city,
          state,
          pin,
        }, input.source);
      }
    } else {
      await this.writeStructuredAddress(user, order, {
        street: (input.address || '').trim(),
        landmark: (input.landmark || '').trim(),
        city: order.city,
        state: order.state,
        pin: order.pincode,
      }, input.source);
    }
    if (effectiveRole(user) === 'demo') await this.demo.note(user, 'demo.address', String(order._id), { source: input.source });
    return this.toDetail(user, order);
  }

  async ingestAddressReply(user: UserDocument, order: OrderDocument, raw: string) {
    if (order.stage !== 'pending') return;
    const stripped = stripReplyPhones(raw);
    order.conversation = [
      ...(order.conversation || []),
      { at: new Date().toISOString(), direction: 'in', kind: 'text', text: 'Address reply' },
    ];
    order.addressReplyEnc = stripped ? this.crypto.encrypt(stripped) : '';
    const key = this.addressKey(user);
    let parsed: ParsedAddress | null = null;
    try {
      parsed = await askGeminiForAddress(key, stripped);
    } catch (error) {
      this.logger.warn(`Address parse missed: ${error instanceof Error ? error.name : 'error'}`);
    }
    if (!parsed) {
      order.addressDraft = null;
      order.exception = 'address';
      order.exceptionWhy = 'Could not read the address';
      order.timeline = pushTimeline(order.timeline, 'address', 'The reply could not be read as an address.');
      await order.save();
      return;
    }
    let offices: Awaited<ReturnType<typeof fetchIndiaPost>> = [];
    try {
      offices = await fetchIndiaPost(parsed.pin);
    } catch (error) {
      this.logger.warn(`India Post missed: ${error instanceof Error ? error.name : 'error'}`);
    }
    const matched = matchPostOffices(parsed, offices);
    order.addressDraft = matched.ok ? matched.address : parsed;
    if (!matched.ok) {
      order.exception = 'address';
      order.exceptionWhy = matched.why;
      order.timeline = pushTimeline(order.timeline, 'address', matched.why);
      await order.save();
      return;
    }
    await this.writeStructuredAddress(user, order, matched.address, 'reply');
  }

  async confirmAddress(user: UserDocument, order: OrderDocument) {
    if (order.exception === 'address') {
      order.exception = null;
      order.exceptionWhy = '';
    }
    order.intervention = 'confirm';
    order.interventionWhy = 'Buyer said the address is correct.';
    order.timeline = pushTimeline(order.timeline, 'address', 'Buyer said the address is correct.');
    await order.save();
    if (reductionSettings(user).autopilot && order.stage === 'pending') {
      const result = await this.whatsapp.dispatchFlow(user, order, 'order_reminder');
      await this.noteDispatch(order, result, 'Asked the buyer to confirm the order.');
    }
  }

  async keepCod(user: UserDocument, order: OrderDocument) {
    if (order.prepaid) order.prepaid = { ...order.prepaid, status: 'declined' };
    order.intervention = 'confirm';
    order.interventionWhy = 'Buyer kept cash on delivery.';
    order.timeline = pushTimeline(order.timeline, 'prepaid', 'Buyer kept cash on delivery');
    await order.save();
    if (reductionSettings(user).autopilot && order.stage === 'pending') {
      const result = await this.whatsapp.dispatchFlow(user, order, 'order_reminder');
      await this.noteDispatch(order, result, 'Asked the buyer to confirm the order.');
    }
  }

  async placeCall(user: UserDocument, id: string, browser: boolean) {
    const order = await this.findOwned(user, id);
    await this.holdDemo(user, ['demo.call', 'demo.call.browser'], 'The demo has started enough buyer calls for today.');
    const plan = await this.dial(user, order, browser ? 'browser' : 'auto');
    if (plan.mode === 'phone') {
      order.callState = 'called';
      order.callConversationId = plan.conversationId;
      order.timeline = pushTimeline(order.timeline, 'call', 'Outbound call placed');
      await order.save();
    }
    if (effectiveRole(user) === 'demo') {
      await this.demo.note(user, plan.mode === 'phone' ? 'demo.call' : 'demo.call.browser', String(order._id), { mode: plan.mode });
    }
    return { ...plan, order: this.toDetail(user, order) };
  }

  async escalate(user: UserDocument, id: string) {
    const order = await this.findOwned(user, id);
    if (order.stage !== 'pending') return this.toDetail(user, order);
    if (buyerReplied(order)) return this.toDetail(user, order);
    if (order.callState === 'called') return this.holdUnconfirmed(user, order);
    order.callDueAt = new Date();
    return this.runEscalation(user, order);
  }

  async applyVoiceOutcome(parsed: { orderId: string; outcome: string; landmark: string; address: string; conversationId: string }) {
    if (!Types.ObjectId.isValid(parsed.orderId)) return;
    const order = await this.orders.findById(parsed.orderId);
    if (!order) return;
    const user = await this.users.findById(order.sellerId);
    if (!user) return;
    order.callConversationId = parsed.conversationId || order.callConversationId;
    order.callState = 'called';
    order.timeline = pushTimeline(order.timeline, 'call', `Call finished: ${parsed.outcome}`);
    if (parsed.outcome === 'confirmed') {
      order.outcome = 'confirmed';
      order.stage = 'closed';
    } else if (parsed.outcome === 'cancelled') {
      order.outcome = 'cancelled';
      order.stage = 'closed';
      if (order.shopifyGid) {
        void this.shopify.cancelOrder(user, order.shopifyGid).catch((error: unknown) => {
          this.logger.warn(`Cancel after call missed: ${error instanceof Error ? error.name : 'error'}`);
        });
      }
    } else if (parsed.outcome === 'address') {
      const line = [parsed.address, parsed.landmark].filter(Boolean).join(', ').slice(0, 300);
      if (line) {
        order.addressEnc = this.crypto.encrypt(line);
        order.addressFixedAt = new Date();
        order.timeline = pushTimeline(order.timeline, 'address', 'Call collected a landmark or address');
        void this.shopify
          .updateShippingAddress(user, order.shopifyGid, {
            address1: (parsed.address || line).slice(0, 200),
            address2: parsed.landmark,
            city: order.city,
            province: order.state,
            zip: order.pincode,
          })
          .catch((error: unknown) => {
            this.logger.warn(`Address writeback missed: ${error instanceof Error ? error.name : 'error'}`);
          });
      }
    } else if (parsed.outcome === 'prepaid') {
      await order.save();
      await this.offerPrepaid(user, String(order._id));
      return;
    } else {
      order.callState = 'held';
      order.intervention = 'hold_review';
      order.interventionWhy = 'The call did not confirm the order. Hold it for the seller.';
    }
    await order.save();
  }

  private async sweepEscalations() {
    const now = new Date();
    await this.orders.updateMany(
      { 'prepaid.status': 'offered', 'prepaid.expiresAt': { $lt: now.toISOString(), $ne: '' } },
      { $set: { 'prepaid.status': 'expired' } },
    );
    const due = await this.orders
      .find({
        stage: 'pending',
        riskBand: 'High',
        whatsappStatus: { $in: ['sent', 'delivered', 'read'] },
        callDueAt: { $lte: now },
        callState: { $in: ['idle', null] },
      })
      .limit(5);
    for (const order of due) {
      if (buyerReplied(order)) continue;
      const user = await this.users.findById(order.sellerId);
      if (user) await this.runEscalation(user, order);
    }
    const holdAfter = new Date(now.getTime() - 15 * 60 * 1000);
    const called = await this.orders.find({ stage: 'pending', callState: 'called', callDueAt: { $lte: holdAfter } }).limit(5);
    for (const order of called) {
      if (buyerReplied(order)) continue;
      const user = await this.users.findById(order.sellerId);
      if (user) await this.holdUnconfirmed(user, order);
    }
  }

  private async runEscalation(user: UserDocument, order: OrderDocument) {
    const plan = await this.dial(user, order, 'phone');
    if (plan.mode === 'phone') {
      order.callState = 'called';
      order.callConversationId = plan.conversationId;
      order.timeline = pushTimeline(order.timeline, 'call', 'Outbound call placed');
    } else {
      order.callState = 'due';
      order.timeline = pushTimeline(order.timeline, 'call_due', plan.notice || 'Call the buyer from the order');
    }
    await order.save();
    return this.toDetail(user, order);
  }

  private async holdUnconfirmed(user: UserDocument, order: OrderDocument) {
    const settings = reductionSettings(user);
    if (settings.noReply === 'cancel') {
      order.callState = 'held';
      order.outcome = 'cancelled';
      order.stage = 'closed';
      order.timeline = pushTimeline(order.timeline, 'cancel', 'No reply. Cancelled because the shop chose cancel.');
      await order.save();
      if (order.shopifyGid) {
        try {
          await this.shopify.cancelForPolicy(user, order.shopifyGid);
          await this.shopify.tagDecision(user, order.shopifyGid, 'cancelled');
        } catch (error) {
          this.logger.warn(`Policy cancel missed: ${error instanceof Error ? error.name : 'error'}`);
          order.exception = 'shopify';
          order.exceptionWhy = 'Shopify did not cancel the order';
          await order.save();
        }
      }
      return this.toDetail(user, order);
    }
    order.callState = 'held';
    order.intervention = 'hold_review';
    order.interventionWhy = 'No confirmation after WhatsApp and a call. Hold for the seller.';
    order.timeline = pushTimeline(order.timeline, 'hold', order.interventionWhy);
    await order.save();
    return this.toDetail(user, order);
  }

  private async runAutopilot(user: UserDocument, pending: OrderDocument[]) {
    try {
      await this.whatsapp.rememberFlows(user);
    } catch (error) {
      this.logger.warn(`Template refresh missed: ${error instanceof Error ? error.name : 'error'}`);
    }
    for (const order of pending) {
      try {
        if (order.intervention === 'auto_confirm') {
          await this.tagConfirmed(user, order);
          continue;
        }
        if (order.stage !== 'pending') continue;
        const waiting = order.whatsappStatus === 'sent' || order.whatsappStatus === 'delivered' || order.whatsappStatus === 'read';
        if (waiting && order.exception !== 'template_pending') continue;
        if (order.intervention === 'request_address') {
          const result = await this.whatsapp.dispatchFlow(user, order, 'address_update_request');
          await this.noteDispatch(order, result, 'Asked the buyer to confirm the address.');
        } else if (order.intervention === 'offer_prepaid') {
          await this.offerPrepaid(user, String(order._id));
        } else if (order.intervention === 'confirm') {
          const result = await this.whatsapp.dispatchFlow(user, order, 'order_reminder');
          await this.noteDispatch(order, result, 'Asked the buyer to confirm the order.');
        }
      } catch (error) {
        this.logger.warn(`Autopilot missed: ${error instanceof Error ? error.name : 'error'}`);
        order.exception = 'send';
        order.exceptionWhy = 'not sent';
        order.whatsappStatus = 'failed';
        await order.save().catch(() => undefined);
      }
    }
  }

  private async tagConfirmed(user: UserDocument, order: OrderDocument) {
    if ((order.timeline || []).some((step) => step.step === 'tagged')) return;
    if (order.shopifyGid) {
      try {
        await this.shopify.tag(user, order.shopifyGid, ['rto-confirmed']);
      } catch (error) {
        this.logger.warn(`Confirm tag missed: ${error instanceof Error ? error.name : 'error'}`);
        order.exception = 'shopify';
        order.exceptionWhy = 'Shopify did not take the tag';
        await order.save();
        return;
      }
    }
    order.timeline = pushTimeline(order.timeline, 'tagged', 'Tagged rto-confirmed.');
    await order.save();
  }

  private async writeStructuredAddress(user: UserDocument, order: OrderDocument, address: ParsedAddress, source: string) {
    const line = [address.street, address.landmark].filter(Boolean).join(', ').slice(0, 300);
    order.addressEnc = this.crypto.encrypt(line || address.street || 'Address');
    if (address.city) order.city = address.city;
    if (address.state) order.state = address.state;
    if (address.pin) order.pincode = address.pin;
    order.addressFixedAt = new Date();
    if (order.exception === 'address') {
      order.exception = null;
      order.exceptionWhy = '';
    }
    order.timeline = pushTimeline(order.timeline, 'address', `Address checked and saved from ${source}.`);
    if (order.intervention === 'request_address') {
      order.intervention = 'confirm';
      order.interventionWhy = 'Address updated. Confirm before it ships.';
    }
    await order.save();
    try {
      await this.shopify.updateShippingAddress(user, order.shopifyGid, {
        address1: (address.street || line).slice(0, 200),
        address2: address.landmark || '',
        city: order.city,
        province: order.state,
        zip: order.pincode,
      });
      if (order.shopifyGid) await this.shopify.tag(user, order.shopifyGid, ['rto-address-fixed']);
    } catch (error) {
      this.logger.warn(`Address writeback missed: ${error instanceof Error ? error.name : 'error'}`);
      order.exception = 'shopify';
      order.exceptionWhy = 'Shopify did not take the address';
      await order.save();
    }
    const spoken = [line, order.city, order.state, order.pincode].filter(Boolean).join(', ');
    const result = await this.whatsapp.dispatchFlow(user, order, 'address_updated_confirmation');
    if (result === 'pending' && sessionOpen(order.conversation)) {
      const sent = await this.whatsapp.sendSessionLine(user, order, `Address updated: ${spoken}`.slice(0, 900));
      if (sent) {
        if (order.exception === 'template_pending') {
          order.exception = null;
          order.exceptionWhy = '';
        }
        await order.save();
      } else {
        await this.noteDispatch(order, result, 'Told the buyer the address was updated.');
      }
    } else {
      await this.noteDispatch(order, result, 'Told the buyer the address was updated.');
    }
    const told = result === 'sent' || result === 'simulated' || result === 'fallback';
    if (reductionSettings(user).autopilot && order.stage === 'pending' && told) {
      const reminder = await this.whatsapp.dispatchFlow(user, order, 'order_reminder');
      await this.noteDispatch(order, reminder, 'Asked the buyer to confirm the order.');
    }
  }

  private async noteDispatch(order: OrderDocument, result: 'sent' | 'simulated' | 'fallback' | 'pending' | 'failed', detail: string) {
    if (result === 'sent' || result === 'simulated' || result === 'fallback') {
      if (order.exception === 'template_pending' || order.exception === 'send') {
        order.exception = null;
        order.exceptionWhy = '';
      }
      const last = order.timeline?.[order.timeline.length - 1];
      if (result === 'fallback') {
        order.timeline = pushTimeline(order.timeline, 'whatsapp', 'The flow template is not approved yet. Sent the confirmation template.');
      } else if (last?.step !== 'whatsapp') {
        order.timeline = pushTimeline(order.timeline, 'whatsapp', detail);
      }
    } else if (result === 'pending') {
      order.exception = 'template_pending';
      order.exceptionWhy = 'template pending';
      order.timeline = pushTimeline(order.timeline, 'whatsapp', 'template pending');
    } else {
      order.exception = 'send';
      order.exceptionWhy = 'not sent';
      order.whatsappStatus = 'failed';
      order.timeline = pushTimeline(order.timeline, 'whatsapp', 'not sent');
    }
    await order.save();
  }

  private addressKey(user: UserDocument) {
    const call = this.geminiCall(user);
    if (call?.mode === 'seller') return call.key || '';
    return process.env.GEMINI_API_KEY || '';
  }

  private openText(enc: string | null | undefined) {
    if (!enc) return '';
    try {
      return this.crypto.decrypt(enc);
    } catch {
      return '';
    }
  }

  private async dial(user: UserDocument, order: OrderDocument, prefer: 'phone' | 'browser' | 'auto') {
    const phone = whatsappNumber(this.crypto.decrypt(order.phoneEnc));
    const visitor = effectiveRole(user) === 'demo';
    const allow = new Set(whatsappAllowlist(process.env.DEMO_WHATSAPP_ALLOWLIST));
    const allowPhone = Boolean(phone) && (!visitor || (phone ? allow.has(phone) : false));
    const mode: 'phone' | 'browser' =
      prefer === 'browser' ? 'browser' : prefer === 'phone' ? 'phone' : allowPhone ? 'phone' : 'browser';
    const settings = reductionSettings(user);
    return this.calls.place(
      user,
      {
        order_id: order.externalOrderId.slice(0, 40),
        rto_order: String(order._id),
        shop_name: user.shopName.slice(0, 60),
        amount: String(Math.round(order.orderValue)),
        action: order.intervention || 'confirm',
        discount: String(settings.discountPct),
      },
      phone,
      allowPhone,
      mode,
    );
  }

  private async holdDemo(user: UserDocument, actions: string[], message: string) {
    if (effectiveRole(user) !== 'demo') return;
    const used = await this.demo.actionsToday(user, actions);
    if (used >= demoSendCap()) throw new HttpException(message, 429);
  }
}
