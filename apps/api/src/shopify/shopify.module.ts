import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { InboxModule } from '../inbox/inbox.module';
import { OrdersModule } from '../orders/orders.module';
import { ShopifyController } from './shopify.controller';
import { ShopifyService } from './shopify.service';

@Module({
  imports: [DatabaseModule, forwardRef(() => OrdersModule), forwardRef(() => InboxModule)],
  controllers: [ShopifyController],
  providers: [ShopifyService],
  exports: [ShopifyService],
})
export class ShopifyModule {}
