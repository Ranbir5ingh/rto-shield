import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/current-user';
import type { UserDocument } from '../database/user.schema';
import { OrdersService } from '../orders/orders.service';
import { DashboardService } from './dashboard.service';

@Controller()
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly orders: OrdersService,
  ) {}

  @Get('dashboard')
  summary(@CurrentUser() user: UserDocument) {
    return this.dashboard.summary(user);
  }

  @Get('model/latest')
  latest(@CurrentUser() user: UserDocument) {
    return this.orders.latestModel(user);
  }
}
