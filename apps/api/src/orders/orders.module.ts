import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DemoModule } from '../demo/demo.module';
import { MlModule } from '../ml/ml.module';
import { ShopifyModule } from '../shopify/shopify.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [DatabaseModule, DemoModule, MlModule, forwardRef(() => ShopifyModule)],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
