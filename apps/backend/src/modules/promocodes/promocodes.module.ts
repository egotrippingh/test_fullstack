import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { RedisModule } from '../redis/redis.module';
import { SyncModule } from '../sync/sync.module';
import { PromocodesController } from './promocodes.controller';
import { PromocodesService } from './promocodes.service';
import { PromoCode, PromoCodeSchema } from './schemas/promocode.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PromoCode.name, schema: PromoCodeSchema }]),
    RedisModule,
    SyncModule
  ],
  controllers: [PromocodesController],
  providers: [PromocodesService],
  exports: [PromocodesService]
})
export class PromocodesModule {}
