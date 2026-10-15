import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MlModule } from '../ml/ml.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [DatabaseModule, MlModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
