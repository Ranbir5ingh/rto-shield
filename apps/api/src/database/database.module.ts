import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditEvent, AuditSchema } from './audit.schema';
import { DemoBaseline, DemoBaselineSchema } from './demo-baseline.schema';
import { DemoSession, DemoSessionSchema } from './demo-session.schema';
import { InboxEvent, InboxSchema } from './inbox.schema';
import { ModelRun, ModelRunSchema } from './model-run.schema';
import { OauthState, OauthStateSchema } from './oauth-state.schema';
import { Order, OrderSchema } from './order.schema';
import { PincodeCache, PincodeCacheSchema } from './pincode-cache.schema';
import { PlatformFlag, PlatformSchema } from './platform.schema';
import { User, UserSchema } from './user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Order.name, schema: OrderSchema },
      { name: ModelRun.name, schema: ModelRunSchema },
      { name: PincodeCache.name, schema: PincodeCacheSchema },
      { name: InboxEvent.name, schema: InboxSchema },
      { name: AuditEvent.name, schema: AuditSchema },
      { name: OauthState.name, schema: OauthStateSchema },
      { name: PlatformFlag.name, schema: PlatformSchema },
      { name: DemoSession.name, schema: DemoSessionSchema },
      { name: DemoBaseline.name, schema: DemoBaselineSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
