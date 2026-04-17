import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PromoUsageDocument = HydratedDocument<PromoUsage>;

@Schema({ timestamps: { createdAt: true, updatedAt: false }, versionKey: false })
export class PromoUsage {
  @Prop({ type: Types.ObjectId, ref: 'PromoCode', required: true })
  promoCodeId!: Types.ObjectId;

  @Prop({ required: true })
  promoCodeCode!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  orderAmount!: number;

  @Prop({ required: true, min: 0 })
  discountAmount!: number;

  createdAt!: Date;
}

export const PromoUsageSchema = SchemaFactory.createForClass(PromoUsage);
