import { Module } from '@nestjs/common';

import { ClickhouseModule } from '../clickhouse/clickhouse.module';
import { RedisModule } from '../redis/redis.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [ClickhouseModule, RedisModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService]
})
export class AnalyticsModule {}
