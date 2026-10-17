import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DemoBaselineDocument = HydratedDocument<DemoBaseline>;

@Schema({ collection: 'demo_baselines', timestamps: false })
export class DemoBaseline {
  @Prop({ type: Types.ObjectId, required: true })
  sellerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  orderId!: Types.ObjectId;

  @Prop({ required: true })
  stage!: string;

  @Prop({ type: String, default: null })
  outcome!: string | null;

  @Prop({ type: String, default: null })
  whatsappStatus!: string | null;

  @Prop({ default: '' })
  whatsappMessageId!: string;

  @Prop({ type: [Object], default: [] })
  conversation!: Array<{ at: string; direction: 'in' | 'out'; kind: string; text: string }>;

  @Prop({ type: Number, default: null })
  riskScore!: number | null;

  @Prop({ type: String, default: null })
  riskBand!: string | null;

  @Prop({ type: [String], default: [] })
  reasons!: string[];

  @Prop({ type: String, default: null })
  predictor!: string | null;
}

export const DemoBaselineSchema = SchemaFactory.createForClass(DemoBaseline);
DemoBaselineSchema.index({ sellerId: 1, orderId: 1 }, { unique: true });
