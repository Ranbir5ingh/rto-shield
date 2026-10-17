import { ForbiddenException, HttpException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditEvent } from '../database/audit.schema';
import { DemoBaseline } from '../database/demo-baseline.schema';
import { DemoSession } from '../database/demo-session.schema';
import { Order, type OrderDocument } from '../database/order.schema';
import { PlatformFlag } from '../database/platform.schema';
import type { UserDocument } from '../database/user.schema';
import { demoResetMs, effectiveRole } from './demo.policy';

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
    if (effectiveRole(user) !== 'demo' || typeof sessionId !== 'string') {
      throw new ForbiddenException('That tour is for a demo session');
    }
    await this.sessions.updateOne({ _id: sessionId }, { $set: { tourSeen: true } });
    await this.note(user, 'demo.tour');
    return { ok: true };
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
    for (const sellerId of sellers) {
      await this.audit.create({ sellerId, action: 'demo.reset', meta: { restored: rows.length } });
    }
    await this.platform.updateOne({ key: RESET_KEY }, { $set: { value: new Date().toISOString() } }, { upsert: true });
    this.logger.log(`Demo baseline restored ${rows.length} orders`);
    return { restored: rows.length, skipped: false };
  }
}
