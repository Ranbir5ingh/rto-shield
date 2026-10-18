import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Envelope } from '@rto/vault';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export interface ShopifyLink {
  shopDomain: string;
  demo: boolean;
  scopes: string;
  tokenEnvelope: Envelope | null;
  installedAt: string | null;
  uninstalledAt: string | null;
  backfill: { status: 'idle' | 'running' | 'done' | 'error'; processed: number; total: number; error: string | null };
  riskTags: { high: string; medium: string; low: string };
  rtoTag: string;
  autoCancelOnBuyerCancel: boolean;
}

export interface WhatsAppLink {
  tokenEnvelope: Envelope | null;
  tokenLast4: string;
  phoneNumberId: string;
  wabaId: string;
  appSecretEnvelope: Envelope | null;
  appSecretLast4: string;
  templateName: string;
  templateStatus: string;
  templateLanguage: string;
  flowStatus?: Record<string, string>;
}

export interface GeminiLink {
  keyEnvelope: Envelope | null;
  last4: string;
  validatedAt: string | null;
}

export interface ReductionSettings {
  autopilot?: boolean;
  prepaidEnabled: boolean;
  discountPct: number;
  minRisk: number;
  escalationMinutes: number;
  noReply?: 'hold' | 'cancel';
}

export interface ElevenLabsLink {
  keyEnvelope: Envelope | null;
  last4: string;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  shopName!: string;

  @Prop({ default: 150 })
  rtoCostInr!: number;

  @Prop({ default: 'hinglish' })
  messageLanguage!: 'hindi' | 'hinglish' | 'english';

  @Prop({ default: 0 })
  tokenVersion!: number;

  @Prop({ default: 'owner', enum: ['owner', 'staff'] })
  role!: 'owner' | 'staff';

  @Prop({ default: false })
  isDemo!: boolean;

  @Prop({ type: Date, default: null })
  sellerTourSeenAt!: Date | null;

  /** Set when a password-login demo owner finishes the demo tour. Live demo sessions keep their own flag. */
  @Prop({ type: Date, default: null })
  demoTourSeenAt!: Date | null;

  @Prop({ type: Object, default: null })
  shopify!: ShopifyLink | null;

  @Prop({ type: Object, default: null })
  whatsapp!: WhatsAppLink | null;

  @Prop({ type: Object, default: null })
  gemini!: GeminiLink | null;

  @Prop({ type: Object, default: null })
  reduction!: ReductionSettings | null;

  @Prop({ type: Object, default: null })
  elevenlabs!: ElevenLabsLink | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
