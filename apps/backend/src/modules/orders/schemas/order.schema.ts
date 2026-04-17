import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

@Schema({ timestamps: true, versionKey: false })
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true, min: 0 })
  finalAmount!: number;

  @Prop({ type: Types.ObjectId, ref: 'PromoCode', default: null })
  promoCodeId!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  promoCodeCode!: string | null;

  @Prop({ default: 0, min: 0 })
  discountAmount!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
