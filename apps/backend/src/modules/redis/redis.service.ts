import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';

import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);

    return value ? (JSON.parse(value) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);

    if (ttlSeconds) {
      await this.redis.set(key, serialized, 'EX', ttlSeconds);
      return;
    }

    await this.redis.set(key, serialized);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async deleteByPattern(pattern: string): Promise<void> {
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');
  }

  async invalidateAnalyticsCache(): Promise<void> {
    await this.deleteByPattern('analytics:*');
  }

  async acquireLock(key: string, ttlMs?: number): Promise<string | null> {
    const token = randomUUID();
    const effectiveTtl =
      ttlMs ?? this.configService.get<number>('redis.lockTtlMs', 10000);

    const result = await this.redis.set(key, token, 'PX', effectiveTtl, 'NX');

    return result === 'OK' ? token : null;
  }

  async releaseLock(key: string, token: string): Promise<void> {
    const releaseScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      end
      return 0
    `;

    await this.redis.eval(releaseScript, 1, key, token);
  }

  async storeRefreshToken(userId: string, tokenId: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(this.getRefreshKey(userId, tokenId), '1', 'EX', ttlSeconds);
  }

  async hasRefreshToken(userId: string, tokenId: string): Promise<boolean> {
    const exists = await this.redis.exists(this.getRefreshKey(userId, tokenId));

    return exists === 1;
  }

  async revokeRefreshToken(userId: string, tokenId: string): Promise<void> {
    await this.redis.del(this.getRefreshKey(userId, tokenId));
  }

  getAnalyticsCacheTtl(): number {
    return this.configService.get<number>('redis.analyticsCacheTtlSeconds', 60);
  }

  private getRefreshKey(userId: string, tokenId: string): string {
    return `refresh:${userId}:${tokenId}`;
  }
}

