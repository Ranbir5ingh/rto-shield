import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

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
}

export const UserSchema = SchemaFactory.createForClass(User);
