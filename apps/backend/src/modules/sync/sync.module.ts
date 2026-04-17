import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ClickhouseModule } from '../clickhouse/clickhouse.module';
import { PromoCode, PromoCodeSchema } from '../promocodes/schemas/promocode.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { PromoUsage, PromoUsageSchema } from '../orders/schemas/promo-usage.schema';
import { SyncService } from './sync.service';

@Module({
  imports: [
    ClickhouseModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: PromoCode.name, schema: PromoCodeSchema },
      { name: Order.name, schema: OrderSchema },
      { name: PromoUsage.name, schema: PromoUsageSchema }
    ])
  ],
  providers: [SyncService],
  exports: [SyncService]
})
export class SyncModule {}
