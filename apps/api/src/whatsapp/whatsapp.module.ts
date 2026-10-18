import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DemoModule } from '../demo/demo.module';
import { InboxModule } from '../inbox/inbox.module';
import { ShopifyModule } from '../shopify/shopify.module';
import { OrdersModule } from '../orders/orders.module';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';

@Module({
  imports: [DatabaseModule, DemoModule, forwardRef(() => ShopifyModule), forwardRef(() => InboxModule), forwardRef(() => OrdersModule)],
  controllers: [WhatsAppController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
