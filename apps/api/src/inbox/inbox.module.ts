import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DemoModule } from '../demo/demo.module';
import { ShopifyModule } from '../shopify/shopify.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';

@Module({
  imports: [DatabaseModule, DemoModule, forwardRef(() => ShopifyModule), forwardRef(() => WhatsAppModule)],
  controllers: [InboxController],
  providers: [InboxService],
  exports: [InboxService],
})
export class InboxModule {}
