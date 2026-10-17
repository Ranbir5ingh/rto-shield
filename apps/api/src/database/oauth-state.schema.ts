import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OauthStateDocument = HydratedDocument<OauthState>;

@Schema({ collection: 'oauth_states' })
export class OauthState {
  @Prop({ required: true, unique: true })
  state!: string;

  @Prop({ type: Types.ObjectId, required: true })
  sellerId!: Types.ObjectId;

  @Prop({ required: true })
  shop!: string;

  @Prop({ required: true })
  expiresAt!: Date;
}

export const OauthStateSchema = SchemaFactory.createForClass(OauthState);
OauthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
