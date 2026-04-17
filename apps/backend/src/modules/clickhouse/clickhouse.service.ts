import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type ClickHouseClient } from '@clickhouse/client';

@Injectable()
export class ClickhouseService implements OnModuleInit {
  private readonly logger = new Logger(ClickhouseService.name);
  private readonly client: ClickHouseClient;

  constructor(private readonly configService: ConfigService) {
    this.client = createClient({
      url: this.configService.get<string>('clickhouse.url', 'http://localhost:8123'),
      database: this.configService.get<string>('clickhouse.database', 'default'),
      username: this.configService.get<string>('clickhouse.username', 'default'),
      password: this.configService.get<string>('clickhouse.password', '')
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.command('SELECT 1');
      await this.ensureTables();
      this.logger.log('ClickHouse is ready');
    } catch (error) {
      this.logger.error('Failed to initialize ClickHouse', error);
    }
  }

  async command(query: string, queryParams?: Record<string, unknown>): Promise<void> {
    await this.client.command({
      query,
      query_params: queryParams
    });
  }

  async query<T>(query: string, queryParams?: Record<string, unknown>): Promise<T[]> {
    const result = await this.client.query({
      query,
      format: 'JSONEachRow',
      query_params: queryParams
    });

    return (await result.json<T>()) as T[];
  }

  async insertRows<T extends Record<string, unknown>>(table: string, rows: T[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await this.client.insert({
      table,
      values: rows.map((row) => this.normalizeRow(row)),
      format: 'JSONEachRow'
    });
  }

  private normalizeRow<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, this.normalizeValue(value)])
    );
  }

  private normalizeValue(value: unknown): unknown {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 19).replace('T', ' ');
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.normalizeValue(entry));
    }

    if (value && typeof value === 'object') {
      return this.normalizeRow(value as Record<string, unknown>);
    }

    return value;
  }

  private async ensureTables(): Promise<void> {
    const tableQueries = [
      `
      CREATE TABLE IF NOT EXISTS users (
        user_id String,
        email String,
        name String,
        phone String,
        role String,
        is_active UInt8,
        created_at DateTime,
        updated_at DateTime
      ) ENGINE = ReplacingMergeTree(updated_at)
      ORDER BY user_id
      `,
      `
      CREATE TABLE IF NOT EXISTS promocodes (
        promocode_id String,
        code String,
        discount_percent UInt8,
        total_usage_limit UInt32,
        per_user_usage_limit UInt32,
        used_count UInt32,
        date_from Nullable(DateTime),
        date_to Nullable(DateTime),
        is_active UInt8,
        created_at DateTime,
        updated_at DateTime
      ) ENGINE = ReplacingMergeTree(updated_at)
      ORDER BY promocode_id
      `,
      `
      CREATE TABLE IF NOT EXISTS orders (
        order_id String,
        user_id String,
        user_email String,
        user_name String,
        amount Float64,
        final_amount Float64,
        promocode_id Nullable(String),
        promocode_code Nullable(String),
        discount_amount Float64,
        created_at DateTime,
        updated_at DateTime
      ) ENGINE = ReplacingMergeTree(updated_at)
      ORDER BY order_id
      `,
      `
      CREATE TABLE IF NOT EXISTS promo_usages (
        usage_id String,
        promocode_id String,
        promo_code String,
        user_id String,
        user_email String,
        user_name String,
        order_id String,
        order_amount Float64,
        discount_amount Float64,
        created_at DateTime
      ) ENGINE = MergeTree
      ORDER BY (created_at, usage_id)
      `
    ];

    for (const query of tableQueries) {
      await this.command(query);
    }
  }
}
