import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditEvent } from '../database/audit.schema';
import { DemoBaseline } from '../database/demo-baseline.schema';
import { DemoSession } from '../database/demo-session.schema';
import { InboxEvent } from '../database/inbox.schema';
import { ModelRun } from '../database/model-run.schema';
import { OauthState } from '../database/oauth-state.schema';
import { Order } from '../database/order.schema';
import { User } from '../database/user.schema';

export interface PurgeCounts {
  users: number;
  shops: number;
  orders: number;
  decisions: number;
  messages: number;
  secrets: number;
  sessions: number;
  snapshots: number;
  calls: number;
  events: number;
  inbox: number;
  oauthStates: number;
  modelRuns: number;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(ModelRun.name) private readonly runs: Model<ModelRun>,
    @InjectModel(AuditEvent.name) private readonly audit: Model<AuditEvent>,
    @InjectModel(DemoSession.name) private readonly sessions: Model<DemoSession>,
    @InjectModel(DemoBaseline.name) private readonly baselines: Model<DemoBaseline>,
    @InjectModel(InboxEvent.name) private readonly inbox: Model<InboxEvent>,
    @InjectModel(OauthState.name) private readonly states: Model<OauthState>,
  ) {}

  async purge(email: string): Promise<PurgeCounts> {
    const user = await this.users.findOne({ email: email.trim().toLowerCase() });
    if (!user) throw new NotFoundException('No account with that email');
    const sellerId = user._id as Types.ObjectId;
    const shop = user.shopify?.shopDomain || '';
    const [tallies] = await this.orders.aggregate<{
      orders: number;
      decisions: number;
      messages: number;
      calls: number;
    }>([
      { $match: { sellerId } },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          decisions: {
            $sum: {
              $cond: [{ $and: [{ $ne: ['$outcome', null] }, { $ne: ['$outcome', ''] }] }, 1, 0],
            },
          },
          messages: { $sum: { $size: { $ifNull: ['$conversation', []] } } },
          calls: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $in: ['$callState', ['due', 'called', 'held']] },
                    { $gt: [{ $strLenCP: { $ifNull: ['$callConversationId', ''] } }, 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const secrets = [
      user.shopify?.tokenEnvelope,
      user.whatsapp?.tokenEnvelope,
      user.whatsapp?.appSecretEnvelope,
      user.gemini?.keyEnvelope,
      user.elevenlabs?.keyEnvelope,
    ].filter(Boolean).length;

    const [orders, runs, sessions, snapshots, states, priorEvents, inbox] = await Promise.all([
      this.orders.deleteMany({ sellerId }),
      this.runs.deleteMany({ sellerId }),
      this.sessions.deleteMany({ userId: sellerId }),
      this.baselines.deleteMany({ sellerId }),
      this.states.deleteMany({ sellerId }),
      this.audit.deleteMany({ sellerId }),
      this.inbox.deleteMany(shop ? { $or: [{ sellerId }, { shop }] } : { sellerId }),
    ]);
    await this.users.deleteOne({ _id: sellerId });

    const counts: PurgeCounts = {
      users: 1,
      shops: user.shopify ? 1 : 0,
      orders: orders.deletedCount || tallies?.orders || 0,
      decisions: tallies?.decisions || 0,
      messages: tallies?.messages || 0,
      secrets,
      sessions: sessions.deletedCount,
      snapshots: snapshots.deletedCount,
      calls: tallies?.calls || 0,
      events: priorEvents.deletedCount,
      inbox: inbox.deletedCount,
      oauthStates: states.deletedCount,
      modelRuns: runs.deletedCount,
    };
    await this.audit.create({
      sellerId,
      action: 'admin.purge',
      meta: {
        users: counts.users,
        shops: counts.shops,
        orders: counts.orders,
        decisions: counts.decisions,
        messages: counts.messages,
        secrets: counts.secrets,
        sessions: counts.sessions,
        snapshots: counts.snapshots,
        calls: counts.calls,
        events: counts.events,
        inbox: counts.inbox,
        oauthStates: counts.oauthStates,
        modelRuns: counts.modelRuns,
      },
    });
    return counts;
  }
}
