import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis =>
        new Redis(configService.get<string>('redis.url', 'redis://localhost:6379'), {
          maxRetriesPerRequest: 3
        })
    },
    RedisService
  ],
  exports: [REDIS_CLIENT, RedisService]
})
export class RedisModule {}

