import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TourNarrationDocument = HydratedDocument<TourNarration>;

@Schema({ timestamps: true, collection: 'tour_narration' })
export class TourNarration {
  @Prop({ required: true, unique: true })
  hash!: string;

  @Prop({ type: Buffer, required: true })
  audio!: Buffer;

  @Prop({ required: true })
  mime!: string;
}

export const TourNarrationSchema = SchemaFactory.createForClass(TourNarration);
