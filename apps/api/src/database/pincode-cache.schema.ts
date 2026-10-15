import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PincodeCacheDocument = HydratedDocument<PincodeCache>;

@Schema({ timestamps: true })
export class PincodeCache {
  @Prop({ required: true, unique: true })
  pincode!: string;

  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>;

  @Prop({ required: true })
  expiresAt!: Date;
}

export const PincodeCacheSchema = SchemaFactory.createForClass(PincodeCache);
PincodeCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
