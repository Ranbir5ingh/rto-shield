import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuditDocument = HydratedDocument<AuditEvent>;

@Schema({ collection: 'audit', timestamps: false })
export class AuditEvent {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  sellerId!: Types.ObjectId;

  @Prop({ required: true })
  action!: string;

  @Prop({ default: '' })
  orderId!: string;

  @Prop({ type: Object, default: {} })
  meta!: Record<string, string | number | boolean | null>;

  @Prop({ default: () => new Date() })
  at!: Date;
}

export const AuditSchema = SchemaFactory.createForClass(AuditEvent);
