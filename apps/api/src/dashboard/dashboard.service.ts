import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from '../database/order.schema';
import type { UserDocument } from '../database/user.schema';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    private readonly orderService: OrdersService,
  ) {}

  async summary(user: UserDocument) {
    const sellerId = user._id;
    const [delivered, rto, history, pending, closed, highPendingOrders, preventedOrders, distribution, trend, reasonDocs, model, wireRows] =
      await Promise.all([
        this.orders.countDocuments({ sellerId, outcome: 'delivered' }),
        this.orders.countDocuments({ sellerId, outcome: 'rto' }),
        this.orders.countDocuments({ sellerId, stage: 'history' }),
        this.orders.countDocuments({ sellerId, stage: 'pending' }),
        this.orders.countDocuments({ sellerId, stage: 'closed' }),
        this.orders.find({ sellerId, stage: 'pending', riskBand: 'High' }).select('orderValue').lean(),
        this.orders
          .find({
            sellerId,
            outcome: 'cancelled',
            riskBand: { $in: ['High', 'Medium'] },
          })
          .select('orderValue')
          .lean(),
        this.orders.aggregate<{ _id: string; count: number }>([
          { $match: { sellerId, stage: 'pending', riskBand: { $in: ['Low', 'Medium', 'High'] } } },
          { $group: { _id: '$riskBand', count: { $sum: 1 } } },
        ]),
        this.orders.aggregate<{ _id: Date; delivered: number; rto: number }>([
          { $match: { sellerId, outcome: { $in: ['delivered', 'rto'] } } },
          {
            $group: {
              _id: { $dateTrunc: { date: '$orderedAt', unit: 'week', timezone: 'Asia/Kolkata' } },
              delivered: { $sum: { $cond: [{ $eq: ['$outcome', 'delivered'] }, 1, 0] } },
              rto: { $sum: { $cond: [{ $eq: ['$outcome', 'rto'] }, 1, 0] } },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        this.orders
          .find({ sellerId, riskScore: { $ne: null } })
          .sort({ updatedAt: -1 })
          .limit(200)
          .select('reasons')
          .lean(),
        this.orderService.latestModel(user),
        this.orders
          .find({ sellerId, stage: 'pending', riskScore: { $ne: null } })
          .sort({ riskScore: -1 })
          .limit(24)
          .select('externalOrderId city orderValue riskBand riskScore')
          .lean(),
      ]);

    const denom = delivered + rto;
    const bands = { Low: 0, Medium: 0, High: 0 };
    for (const row of distribution) {
      if (row._id === 'Low' || row._id === 'Medium' || row._id === 'High') bands[row._id] = row.count;
    }
    const reasonCounts = new Map<string, number>();
    for (const doc of reasonDocs) {
      for (const reason of doc.reasons || []) reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }
    const topReasons = [...reasonCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([reason, count]) => ({ reason, count }));

    return {
      rtoRate: denom ? Math.round((rto / denom) * 1000) / 10 : null,
      delivered,
      rto,
      savedInr: moneyAtRisk(preventedOrders, user.rtoCostInr),
      prevented: preventedOrders.length,
      rtoCostInr: user.rtoCostInr,
      exposureInr: moneyAtRisk(highPendingOrders, user.rtoCostInr),
      highPending: highPendingOrders.length,
      upgrading: this.orderService.isUpgrading(String(user._id)),
      trend: trend.map((row) => {
        const total = row.delivered + row.rto;
        return {
          week: row._id ? new Date(row._id).toISOString().slice(0, 10) : '',
          delivered: row.delivered,
          rto: row.rto,
          rate: total ? Math.round((row.rto / total) * 1000) / 10 : null,
        };
      }),
      distribution: bands,
      topReasons,
      model,
      counts: { history, pending, closed },
      liveWire: spreadWire(wireRows),
      ...(await this.action(user)),
    };
  }

  private async action(user: UserDocument) {
    const sellerId = user._id;
    const [actionToday, confirmed, declined, pins, fresh, repeatBuyers] = await Promise.all([
      this.orders.countDocuments({ sellerId, stage: 'pending', riskBand: { $in: ['High', 'Medium'] } }),
      this.orders.countDocuments({ sellerId, outcome: 'confirmed' }),
      this.orders.countDocuments({ sellerId, outcome: { $in: ['cancelled', 'no_response'] } }),
      this.orders.aggregate<{ _id: string; orders: number; rto: number }>([
        { $match: { sellerId, outcome: { $in: ['delivered', 'rto'] }, pincode: { $nin: ['', '000000'] } } },
        {
          $group: {
            _id: '$pincode',
            orders: { $sum: 1 },
            rto: { $sum: { $cond: [{ $eq: ['$outcome', 'rto'] }, 1, 0] } },
          },
        },
        { $match: { orders: { $gte: 3 } } },
        { $sort: { rto: -1, orders: -1 } },
        { $limit: 5 },
      ]),
      this.orders.countDocuments({ sellerId, stage: 'pending', priorOrders: 0 }),
      this.orders.countDocuments({ sellerId, stage: 'pending', priorOrders: { $gt: 0 } }),
    ]);
    const decided = confirmed + declined;
    return {
      actionToday,
      confirmationRate: decided ? Math.round((confirmed / decided) * 1000) / 10 : null,
      pinInsights: pins.map((row) => ({
        pincode: row._id,
        orders: row.orders,
        rto: row.rto,
        rate: row.orders ? Math.round((row.rto / row.orders) * 1000) / 10 : 0,
      })),
      buyers: { fresh, repeat: repeatBuyers },
    };
  }
}

function spreadWire(
  rows: Array<{
    _id: unknown;
    externalOrderId?: string;
    city?: string;
    orderValue?: number;
    riskBand?: 'Low' | 'Medium' | 'High' | null;
    riskScore?: number | null;
  }>,
) {
  const buckets: Record<'High' | 'Medium' | 'Low', typeof rows> = { High: [], Medium: [], Low: [] };
  for (const row of rows) {
    if (row.riskBand === 'High' || row.riskBand === 'Medium' || row.riskBand === 'Low') buckets[row.riskBand].push(row);
  }
  const picked = [...buckets.High.slice(0, 2), ...buckets.Medium.slice(0, 2), ...buckets.Low.slice(0, 2)];
  if (picked.length < 6) {
    const seen = new Set(picked.map((row) => String(row._id)));
    for (const row of rows) {
      if (picked.length >= 6) break;
      const id = String(row._id);
      if (seen.has(id)) continue;
      seen.add(id);
      picked.push(row);
    }
  }
  return picked.slice(0, 6).map((row) => ({
    id: String(row._id),
    externalOrderId: row.externalOrderId || '',
    city: row.city || '',
    orderValue: row.orderValue || 0,
    riskBand: row.riskBand ?? null,
    riskScore: row.riskScore ?? null,
  }));
}

function moneyAtRisk(orders: Array<{ orderValue?: number }>, shippingBothWays: number) {
  return orders.reduce((sum, order) => sum + (order.orderValue || 0) + shippingBothWays, 0);
}
