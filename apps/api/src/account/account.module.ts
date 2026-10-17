import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { OrdersModule } from '../orders/orders.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { SecretsController } from './secrets.controller';
import { SecretsService } from './secrets.service';

@Module({
  imports: [AuthModule, OrdersModule, DatabaseModule],
  controllers: [AccountController, SecretsController],
  providers: [AccountService, SecretsService],
})
export class AccountModule {}
