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
    const [delivered, rto, history, pending, closed, highPending, prevented, distribution, trend, reasonDocs, model] =
      await Promise.all([
        this.orders.countDocuments({ sellerId, outcome: 'delivered' }),
        this.orders.countDocuments({ sellerId, outcome: 'rto' }),
        this.orders.countDocuments({ sellerId, stage: 'history' }),
        this.orders.countDocuments({ sellerId, stage: 'pending' }),
        this.orders.countDocuments({ sellerId, stage: 'closed' }),
        this.orders.countDocuments({ sellerId, stage: 'pending', riskBand: 'High' }),
        this.orders.countDocuments({
          sellerId,
          outcome: 'cancelled',
          riskBand: { $in: ['High', 'Medium'] },
        }),
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
      savedInr: prevented * user.rtoCostInr,
      prevented,
      rtoCostInr: user.rtoCostInr,
      exposureInr: highPending * user.rtoCostInr,
      highPending,
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
    };
  }
}
