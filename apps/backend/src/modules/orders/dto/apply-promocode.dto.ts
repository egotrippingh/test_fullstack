import { IsString } from 'class-validator';

export class ApplyPromoCodeDto {
  @IsString()
  promoCode!: string;
}
