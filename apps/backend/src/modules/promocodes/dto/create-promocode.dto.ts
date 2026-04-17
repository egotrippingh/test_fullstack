import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePromoCodeDto {
  @IsString()
  code!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  discountPercent!: number;

  @IsInt()
  @Min(0)
  totalUsageLimit!: number;

  @IsInt()
  @Min(0)
  perUserUsageLimit!: number;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
