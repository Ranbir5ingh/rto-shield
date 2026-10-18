import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OrdersModule } from '../orders/orders.module';
import { NarrationService } from '../tours/narration.service';
import { ElevenLabsController } from './elevenlabs.controller';
import { ElevenLabsService } from './elevenlabs.service';

@Module({
  imports: [DatabaseModule, forwardRef(() => OrdersModule)],
  controllers: [ElevenLabsController],
  providers: [ElevenLabsService, NarrationService],
  exports: [ElevenLabsService, NarrationService],
})
export class VoiceModule {}
