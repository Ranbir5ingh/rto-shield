import { BadRequestException, forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import type { UserDocument } from '../database/user.schema';
import { MlService, type GeminiCall } from '../ml/ml.service';
import { DemoService } from '../demo/demo.service';
import { effectiveRole } from '../demo/demo.policy';
import { ShopifyService } from '../shopify/shopify.service';
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
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly upgrading = new Set<string>();

  constructor(
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(ModelRun.name) private readonly runs: Model<ModelRun>,
    private readonly crypto: CryptoService,
    private readonly vault: VaultService,
    private readonly ml: MlService,
    @Inject(forwardRef(() => ShopifyService)) private readonly shopify: ShopifyService,
    private readonly demo: DemoService,
  ) {}

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

  async list(user: UserDocument, stage: string | undefined, limit: number, offset: number) {
    const filter: Record<string, unknown> = { sellerId: user._id };
    if (stage) filter.stage = stage;
    const [items, total] = await Promise.all([
      this.orders.find(filter).sort({ orderedAt: -1 }).skip(offset).limit(limit),
      this.orders.countDocuments(filter),
    ]);
    return { total, orders: items.map((order) => this.toList(order)) };
  }

  async getOne(user: UserDocument, id: string) {
    const order = await this.findOwned(user, id);
    return this.toDetail(user, order);
  }

  async queue(user: UserDocument) {
    const items = await this.orders
      .find({ sellerId: user._id, stage: 'pending', riskBand: { $in: ['High', 'Medium'] } })
      .sort({ riskScore: -1 })
      .limit(200);
    return { orders: items.map((order) => this.toDetail(user, order)) };
  }

  async markOutcome(user: UserDocument, id: string, outcome: 'confirmed' | 'cancelled' | 'no_response') {
    const order = await this.findOwned(user, id);
    if (order.stage !== 'pending') return this.toDetail(user, order);
    await this.demo.capture(user, [order]);
    order.outcome = outcome;
    order.stage = 'closed';
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
    if (user.isDemo) return undefined;
    if (!user.gemini?.keyEnvelope || !user.gemini.validatedAt) return { mode: 'seller', key: '' };
    try {
      return { mode: 'seller', key: this.vault.open(user.gemini.keyEnvelope) };
    } catch {
      return { mode: 'seller', key: '' };
    }
  }

  private async refreshGemma(user: UserDocument) {
    try {
      const gemini = this.geminiCall(user);
      if (gemini?.mode === 'seller' && !gemini.key) return;
      if (!gemini) {
        const health = await this.ml.health(4_000);
        if (!health?.gemini && !health?.ollama_configured) return;
      }
      const pending = await this.orders.find({ sellerId: user._id, stage: 'pending' }).limit(80);
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
        } catch (error) {
          this.logger.warn(`Gemma address batch missed: ${error instanceof Error ? error.name : 'error'}`);
        }
      }
      const risky = pending.filter((order) => order.riskBand === 'High' || order.riskBand === 'Medium');
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
        outcome: { $in: ['delivered', 'rto', 'confirmed', 'cancelled'] },
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
              : order.outcome === 'delivered' || order.outcome === 'confirmed'
                ? 'delivered'
                : null,
        };
      });
      result = scoreWithRules(prepared);
    }
    const byId = new Map(result.predictions.map((row) => [row.id, row]));
    // Templates land with the score. Gemma replaces notes and drafts afterwards, off this timer.
    const now = new Date();
    const writes: Array<{ updateOne: { filter: { _id: OrderDocument['_id']; sellerId: UserDocument['_id'] }; update: { $set: Record<string, unknown> } } }> = [];
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
      writes.push({
        updateOne: {
          filter: { _id: order._id, sellerId: user._id },
          update: {
            $set: {
              riskScore: order.riskScore,
              riskBand: order.riskBand,
              reasons: order.reasons,
              addressQuality: order.addressQuality,
              messages: order.messages,
              predictor: order.predictor,
              updatedAt: now,
            },
          },
        },
      });
    }
    if (writes.length) await this.orders.bulkWrite(writes, { ordered: false });
    this.writeShopify(user, pending);

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
    };
  }
}
