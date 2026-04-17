import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PromoCodeDocument = HydratedDocument<PromoCode>;

@Schema({ timestamps: true, versionKey: false })
export class PromoCode {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code!: string;

  @Prop({ required: true, min: 1, max: 100 })
  discountPercent!: number;

  @Prop({ required: true, min: 0 })
  totalUsageLimit!: number;

  @Prop({ required: true, min: 0 })
  perUserUsageLimit!: number;

  @Prop({ default: 0, min: 0 })
  usedCount!: number;

  @Prop({ type: Date, default: null })
  dateFrom?: Date | null;

  @Prop({ type: Date, default: null })
  dateTo?: Date | null;

  @Prop({ default: true })
  isActive!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PromoCodeSchema = SchemaFactory.createForClass(PromoCode);
