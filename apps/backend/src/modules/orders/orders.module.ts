import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PromocodesModule } from '../promocodes/promocodes.module';
import { RedisModule } from '../redis/redis.module';
import { SyncModule } from '../sync/sync.module';
import { UsersModule } from '../users/users.module';
import { PromoCode, PromoCodeSchema } from '../promocodes/schemas/promocode.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order, OrderSchema } from './schemas/order.schema';
import { PromoUsage, PromoUsageSchema } from './schemas/promo-usage.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: PromoUsage.name, schema: PromoUsageSchema },
      { name: PromoCode.name, schema: PromoCodeSchema },
      { name: User.name, schema: UserSchema }
    ]),
    UsersModule,
    PromocodesModule,
    RedisModule,
    SyncModule
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService]
})
export class OrdersModule {}
