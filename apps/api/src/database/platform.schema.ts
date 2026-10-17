import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PlatformDocument = HydratedDocument<PlatformFlag>;

export const WHATSAPP_WEBHOOK_VERIFIED_KEY = 'whatsapp.webhookVerifiedAt';

@Schema({ collection: 'platform', timestamps: false })
export class PlatformFlag {
  @Prop({ required: true, unique: true })
  key!: string;

  @Prop({ required: true })
  value!: string;
}

export const PlatformSchema = SchemaFactory.createForClass(PlatformFlag);
