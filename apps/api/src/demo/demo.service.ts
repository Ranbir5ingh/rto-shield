import { ForbiddenException, HttpException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditEvent } from '../database/audit.schema';
import { DemoBaseline } from '../database/demo-baseline.schema';
import { DemoSession } from '../database/demo-session.schema';
import { Order, type OrderDocument } from '../database/order.schema';
import { PlatformFlag } from '../database/platform.schema';
import type { UserDocument } from '../database/user.schema';
import { demoCallWindow, demoResetMs, effectiveRole, hashDemoIp, isDemoSession } from './demo.policy';

const RESET_KEY = 'demo.resetAt';

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    @InjectModel(DemoBaseline.name) private readonly baselines: Model<DemoBaseline>,
    @InjectModel(DemoSession.name) private readonly sessions: Model<DemoSession>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(AuditEvent.name) private readonly audit: Model<AuditEvent>,
    @InjectModel(PlatformFlag.name) private readonly platform: Model<PlatformFlag>,
  ) {}

  async capture(user: UserDocument, orders: OrderDocument[]) {
    if (effectiveRole(user) !== 'demo' || !orders.length) return;
    for (const order of orders) {
      await this.baselines.updateOne(
        { sellerId: user._id, orderId: order._id },
        {
          $setOnInsert: {
            sellerId: user._id,
            orderId: order._id,
            stage: order.stage,
            outcome: order.outcome,
            whatsappStatus: order.whatsappStatus,
            whatsappMessageId: order.whatsappMessageId,
            conversation: order.conversation || [],
            riskScore: order.riskScore,
            riskBand: order.riskBand,
            reasons: order.reasons || [],
            predictor: order.predictor,
          },
        },
        { upsert: true },
      );
    }
  }

  async note(user: UserDocument, action: string, orderId = '', meta: Record<string, string | number | boolean | null> = {}) {
    if (effectiveRole(user) !== 'demo') return;
    await this.audit.create({ sellerId: user._id, action, orderId, meta });
  }

  async demoCallBudget(user: UserDocument, ip: string) {
    if (!isDemoSession(user)) {
      return { applies: false, cap: 2, remaining: 2, resetsAt: null, windowMinutes: 30 };
    }
    const sessionId = typeof user.$locals?.demoSessionId === 'string' ? user.$locals.demoSessionId : '';
    const ipHash = hashDemoIp(ip || 'unknown');
    const since = new Date(Date.now() - 30 * 60 * 1000);
    const rows = await this.audit
      .find({
        sellerId: user._id,
        action: { $in: ['demo.call', 'demo.call.browser'] },
        at: { $gte: since },
      })
      .select('at meta')
      .lean();
    const budget = demoCallWindow({
      now: Date.now(),
      sessionId,
      ipHash,
      calls: rows.map((row) => ({
        at: new Date(row.at).getTime(),
        sessionId: String(row.meta?.sessionId || ''),
        ipHash: String(row.meta?.ipHash || ''),
      })),
    });
    return { applies: true, ...budget };
  }

  async assertDemoCallWindow(user: UserDocument, ip: string) {
    const budget = await this.demoCallBudget(user, ip);
    if (!budget.applies || budget.remaining > 0) return budget;
    throw new HttpException(
      {
        message: 'Two demo calls are used in this half hour.',
        details: budget,
      },
      429,
    );
  }

  async recordDemoCall(user: UserDocument, orderId: string, mode: string, ip: string) {
    if (!isDemoSession(user)) return;
    const sessionId = typeof user.$locals?.demoSessionId === 'string' ? user.$locals.demoSessionId : '';
    await this.audit.create({
      sellerId: user._id,
      action: mode === 'phone' ? 'demo.call' : 'demo.call.browser',
      orderId,
      meta: { mode, sessionId, ipHash: hashDemoIp(ip || 'unknown') },
    });
  }

  async actionsToday(user: UserDocument, actions: string[]): Promise<number> {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    return this.audit.countDocuments({
      sellerId: user._id,
      action: { $in: actions },
      at: { $gte: start },
    });
  }

  async sendsToday(user: UserDocument): Promise<number> {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    return this.audit.countDocuments({
      sellerId: user._id,
      action: { $in: ['demo.whatsapp.send', 'demo.whatsapp.simulated'] },
      at: { $gte: start },
    });
  }

  assertSendRoom(used: number, cap: number) {
    if (used >= cap) {
      throw new HttpException('The demo has sent enough WhatsApp messages for today.', 429);
    }
  }

  async completeTour(user: UserDocument, tour: 'seller' | 'demo') {
    if (tour === 'seller') {
      if (effectiveRole(user) === 'demo') throw new ForbiddenException('Demo sessions keep their own tour');
      user.sellerTourSeenAt = new Date();
      await user.save();
      return { ok: true };
    }
    const sessionId = user.$locals?.demoSessionId;
    if (effectiveRole(user) === 'demo' && typeof sessionId === 'string') {
      await this.sessions.updateOne({ _id: sessionId }, { $set: { tourSeen: true } });
      await this.note(user, 'demo.tour');
      return { ok: true };
    }
    // Try-demo can sign in as the demo owner (role owner, isDemo) without a visitor session.
    if (user.isDemo) {
      user.demoTourSeenAt = new Date();
      await user.save();
      await this.audit.create({ sellerId: user._id, action: 'demo.tour', meta: {} });
      return { ok: true };
    }
    throw new ForbiddenException('That tour is for a demo session');
  }

  async outcomeStamp(user: UserDocument) {
    return this.audit.countDocuments({ sellerId: user._id, action: 'demo.outcomes' });
  }

  async stampOutcomes(user: UserDocument, meta: Record<string, number>) {
    await this.audit.create({ sellerId: user._id, action: 'demo.outcomes', meta });
  }

  async maybeReset() {
    const row = await this.platform.findOne({ key: RESET_KEY }).lean();
    const last = row ? Date.parse(row.value) : 0;
    if (Number.isFinite(last) && Date.now() - last < demoResetMs()) return { restored: 0, skipped: true };
    return this.reset();
  }

  async reset() {
    const rows = await this.baselines.find().limit(2000);
    const sellers = new Set<string>();
    for (const row of rows) {
      await this.orders.updateOne(
        { _id: row.orderId, sellerId: row.sellerId },
        {
          $set: {
            stage: row.stage,
            outcome: row.outcome,
            whatsappStatus: row.whatsappStatus,
            whatsappMessageId: row.whatsappMessageId,
            conversation: row.conversation,
            riskScore: row.riskScore,
            riskBand: row.riskBand,
            reasons: row.reasons,
            predictor: row.predictor,
          },
        },
      );
      sellers.add(String(row.sellerId));
    }
    if (rows.length) await this.baselines.deleteMany({ _id: { $in: rows.map((row) => row._id) } });
    const cleared = await this.audit.deleteMany({ action: 'demo.outcomes' });
    for (const sellerId of sellers) {
      await this.audit.create({ sellerId, action: 'demo.reset', meta: { restored: rows.length } });
    }
    await this.platform.updateOne({ key: RESET_KEY }, { $set: { value: new Date().toISOString() } }, { upsert: true });
    this.logger.log(`Demo baseline restored ${rows.length} orders`);
    return { restored: rows.length, skipped: false, clearedOutcomes: cleared.deletedCount };
  }
}
