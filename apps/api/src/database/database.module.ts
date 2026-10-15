import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ModelRun, ModelRunSchema } from './model-run.schema';
import { Order, OrderSchema } from './order.schema';
import { PincodeCache, PincodeCacheSchema } from './pincode-cache.schema';
import { User, UserSchema } from './user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Order.name, schema: OrderSchema },
      { name: ModelRun.name, schema: ModelRunSchema },
      { name: PincodeCache.name, schema: PincodeCacheSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
