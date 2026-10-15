import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  sellerId!: Types.ObjectId;

  @Prop({ required: true })
  externalOrderId!: string;

  @Prop({ required: true })
  buyerNameEnc!: string;

  @Prop({ required: true })
  phoneEnc!: string;

  @Prop({ required: true })
  phoneMasked!: string;

  @Prop({ required: true })
  addressEnc!: string;

  @Prop({ default: '' })
  city!: string;

  @Prop({ default: '' })
  state!: string;

  @Prop({ required: true })
  pincode!: string;

  @Prop({ required: true })
  orderValue!: number;

  @Prop({ required: true, enum: ['cod', 'prepaid'] })
  paymentType!: 'cod' | 'prepaid';

  @Prop({ required: true })
  orderedAt!: Date;

  @Prop({ required: true })
  hour!: number;

  @Prop({ default: 0 })
  priorOrders!: number;

  @Prop({ default: 0 })
  priorRtos!: number;

  @Prop({ default: '' })
  productName!: string;

  @Prop({ default: '' })
  courier!: string;

  @Prop({ required: true, enum: ['history', 'pending', 'closed'] })
  stage!: 'history' | 'pending' | 'closed';

  @Prop({ type: String, default: null })
  outcome!: 'delivered' | 'rto' | 'confirmed' | 'cancelled' | 'no_response' | null;

  @Prop({ required: true, enum: ['shopify', 'meesho', 'generic', 'manual', 'sample'] })
  source!: 'shopify' | 'meesho' | 'generic' | 'manual' | 'sample';

  @Prop({ type: Number, default: null })
  riskScore!: number | null;

  @Prop({ type: String, default: null })
  riskBand!: 'Low' | 'Medium' | 'High' | null;

  @Prop({ type: [String], default: [] })
  reasons!: string[];

  @Prop({ type: Object, default: null })
  addressQuality!: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  messages!: {
    hindi: string;
    hinglish: string;
    english: string;
    prepaid_nudge: string;
    voice_script_hi: string;
    source: string;
  } | null;

  @Prop({ type: String, default: null })
  predictor!: string | null;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ sellerId: 1, externalOrderId: 1 }, { unique: true });
OrderSchema.index({ sellerId: 1, stage: 1, riskScore: -1 });
OrderSchema.index({ sellerId: 1, orderedAt: -1 });
