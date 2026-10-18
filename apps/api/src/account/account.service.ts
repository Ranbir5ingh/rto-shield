import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import type { SettingsInput } from '../common/validation';
import { ModelRun } from '../database/model-run.schema';
import { Order } from '../database/order.schema';
import { User, type UserDocument } from '../database/user.schema';
import { AuthService } from '../auth/auth.service';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class AccountService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(ModelRun.name) private readonly runs: Model<ModelRun>,
    private readonly auth: AuthService,
    private readonly orderService: OrdersService,
  ) {}

  async updateSettings(user: UserDocument, input: SettingsInput) {
    if (input.name !== undefined) user.name = input.name;
    if (input.shopName !== undefined) user.shopName = input.shopName;
    if (input.rtoCostInr !== undefined) user.rtoCostInr = input.rtoCostInr;
    if (input.messageLanguage !== undefined) user.messageLanguage = input.messageLanguage;
    const reduction = {
      autopilot: input.autopilot ?? user.reduction?.autopilot ?? true,
      prepaidEnabled: input.prepaidEnabled ?? user.reduction?.prepaidEnabled ?? true,
      discountPct: input.discountPct ?? user.reduction?.discountPct ?? 5,
      minRisk: input.minRisk ?? user.reduction?.minRisk ?? 60,
      escalationMinutes: input.escalationMinutes ?? user.reduction?.escalationMinutes ?? 120,
      noReply: input.noReply ?? user.reduction?.noReply ?? 'hold',
    };
    if (
      input.prepaidEnabled !== undefined ||
      input.discountPct !== undefined ||
      input.minRisk !== undefined ||
      input.escalationMinutes !== undefined ||
      input.autopilot !== undefined ||
      input.noReply !== undefined
    ) {
      user.reduction = reduction;
    }
    await user.save();
    return { user: this.auth.toPublic(user) };
  }

  exportCsv(user: UserDocument) {
    return this.orderService.exportCsv(user);
  }

  async deleteData(user: UserDocument) {
    await this.orders.deleteMany({ sellerId: user._id });
    await this.runs.deleteMany({ sellerId: user._id });
    return { ok: true };
  }

  async deleteAccount(user: UserDocument, password: string) {
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid email or password');
    await this.orders.deleteMany({ sellerId: user._id });
    await this.runs.deleteMany({ sellerId: user._id });
    await this.users.deleteOne({ _id: user._id });
    return { ok: true };
  }
}
