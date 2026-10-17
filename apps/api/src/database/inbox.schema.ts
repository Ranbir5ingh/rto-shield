import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InboxDocument = HydratedDocument<InboxEvent>;

@Schema({ collection: 'inbox', timestamps: true })
export class InboxEvent {
  @Prop({ required: true, unique: true })
  webhookId!: string;

  @Prop({ required: true, enum: ['shopify', 'whatsapp'] })
  provider!: 'shopify' | 'whatsapp';

  @Prop({ required: true })
  topic!: string;

  @Prop({ default: '' })
  shop!: string;

  @Prop({ type: Types.ObjectId, default: null })
  sellerId!: Types.ObjectId | null;

  /** Buyer payload, encrypted with ENCRYPTION_KEY. Cleared after a successful drain. */
  @Prop({ default: '' })
  payloadEnc!: string;

  @Prop({ required: true, enum: ['pending', 'processing', 'done', 'failed'], default: 'pending' })
  status!: 'pending' | 'processing' | 'done' | 'failed';

  @Prop({ default: 0 })
  attempts!: number;

  @Prop({ default: () => new Date() })
  receivedAt!: Date;

  @Prop({ type: Date, default: null })
  processedAt!: Date | null;

  @Prop({ default: '' })
  error!: string;
}

export const InboxSchema = SchemaFactory.createForClass(InboxEvent);
InboxSchema.index({ status: 1, receivedAt: 1 });
