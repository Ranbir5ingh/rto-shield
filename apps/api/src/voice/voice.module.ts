import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OrdersModule } from '../orders/orders.module';
import { ElevenLabsController } from './elevenlabs.controller';
import { ElevenLabsService } from './elevenlabs.service';

@Module({
  imports: [DatabaseModule, forwardRef(() => OrdersModule)],
  controllers: [ElevenLabsController],
  providers: [ElevenLabsService],
  exports: [ElevenLabsService],
})
export class VoiceModule {}
