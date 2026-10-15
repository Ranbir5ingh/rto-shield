import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MlModule } from '../ml/ml.module';
import { IntegrationsController } from './integrations.controller';
import { PincodeService } from './pincode.service';
import { VoiceService } from './voice.service';

@Module({
  imports: [MlModule, DatabaseModule],
  controllers: [IntegrationsController],
  providers: [PincodeService, VoiceService],
})
export class IntegrationsModule {}
