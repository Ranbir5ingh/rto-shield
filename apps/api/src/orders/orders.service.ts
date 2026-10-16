import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
import { hourInKolkata } from '../common/hour';
import { assertSafeVoiceScript, templateMessage, type DraftMessage } from '../common/messages';
import { maskPhone, whatsappNumber } from '../common/phone';
import { generateSample } from '../common/sample';
import type { ColumnMapping, ImportInput, ManualOrderInput } from '../common/validation';
import { ModelRun } from '../database/model-run.schema';
import { Order, type OrderDocument } from '../database/order.schema';
import type { UserDocument } from '../database/user.schema';
import { MlService } from '../ml/ml.service';
import { toMlOrder } from '../ml/payload';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(ModelRun.name) private readonly runs: Model<ModelRun>,
    private readonly crypto: CryptoService,
    private readonly ml: MlService,
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
    if (order.stage !== 'pending') throw new BadRequestException('Only pending orders can be updated');
    order.outcome = outcome;
    order.stage = 'closed';
    await order.save();
    return this.toDetail(user, order);
  }

  async score(user: UserDocument, options?: { fast?: boolean }) {
    const pending = await this.orders.find({ sellerId: user._id, stage: 'pending' }).limit(500);
    if (!pending.length) {
      const latest = await this.latestModel(user);
      return { scored: 0, message: 'No pending orders to score.', model: latest };
    }
    const history = await this.orders
      .find({
        sellerId: user._id,
        outcome: { $in: ['delivered', 'rto', 'confirmed', 'cancelled'] },
      })
      .sort({ orderedAt: -1 })
      .limit(5000);

    const historyPayload = history.map((order) =>
      toMlOrder({
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
      }),
    );
    const pendingPayload = pending.map((order) =>
      toMlOrder({
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
        outcome: null,
      }),
    );

    const fast = options?.fast === true;
    const result = await this.ml.predict(historyPayload, pendingPayload, {
      speed: fast ? 'fast' : 'full',
      timeoutMs: fast ? 12_000 : 60_000,
    });
    const byId = new Map(result.predictions.map((row) => [row.id, row]));
    const risky = pending.filter((order) => {
      const band = byId.get(String(order._id))?.band;
      return band === 'High' || band === 'Medium';
    });
    const drafts = new Map<string, DraftMessage>();
    // Demo opening stays on local templates. Gemma drafts happen on an explicit Score.
    if (risky.length && !fast) {
      try {
        const generated = await this.ml.messages(
          user.shopName,
          risky.map((order) => ({
            id: String(order._id),
            first_name: this.firstName(order),
            order_value: order.orderValue,
            product_name: order.productName || 'order',
            payment_type: order.paymentType,
          })),
        );
        for (const message of generated.messages) drafts.set(message.id, message);
        result.warnings.push(...generated.warnings);
      } catch {
        result.warnings.push('Confirmation drafts used built-in templates because Gemma was unreachable.');
      }
    }

    for (const order of pending) {
      const prediction = byId.get(String(order._id));
      if (!prediction) continue;
      order.riskScore = prediction.score;
      order.riskBand = prediction.band;
      order.reasons = prediction.reasons;
      order.addressQuality = prediction.address_quality as unknown as Record<string, unknown>;
      order.predictor = result.model;
      if (prediction.band === 'High' || prediction.band === 'Medium') {
        const draft =
          drafts.get(String(order._id)) ||
          templateMessage(user.shopName, this.firstName(order), order.orderValue, order.productName);
        draft.voice_script_hi = assertSafeVoiceScript(draft.voice_script_hi, user.shopName, order.orderValue);
        order.messages = draft;
      }
      await order.save();
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
    };
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
    };
  }
}
