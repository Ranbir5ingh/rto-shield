import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { InboxModule } from '../inbox/inbox.module';
import { ShopifyModule } from '../shopify/shopify.module';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';

@Module({
  imports: [DatabaseModule, forwardRef(() => ShopifyModule), forwardRef(() => InboxModule)],
  controllers: [WhatsAppController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
