import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DemoSessionDocument = HydratedDocument<DemoSession>;

@Schema({ collection: 'demo_sessions', timestamps: true })
export class DemoSession {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ default: false })
  tourSeen!: boolean;

  @Prop({ default: '' })
  ipHash!: string;
}

export const DemoSessionSchema = SchemaFactory.createForClass(DemoSession);
DemoSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
