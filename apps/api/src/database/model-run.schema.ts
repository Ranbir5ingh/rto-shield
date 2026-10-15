import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ModelRunDocument = HydratedDocument<ModelRun>;

@Schema({ timestamps: true })
export class ModelRun {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  sellerId!: Types.ObjectId;

  @Prop({ required: true })
  model!: string;

  @Prop({ required: true })
  modelLabel!: string;

  @Prop({ type: Object, default: null })
  metrics!: {
    auc: number | null;
    precision_at_top_10pct: number | null;
    n_train: number;
    n_test: number;
    positive_rate_test: number;
  } | null;

  @Prop({ default: 'heuristic' })
  addressSource!: string;

  @Prop({ type: [String], default: [] })
  warnings!: string[];
}

export const ModelRunSchema = SchemaFactory.createForClass(ModelRun);
