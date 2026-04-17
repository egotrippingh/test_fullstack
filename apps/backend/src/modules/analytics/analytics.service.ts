import { BadRequestException, Injectable } from '@nestjs/common';

import { ClickhouseService } from '../clickhouse/clickhouse.service';
import { RedisService } from '../redis/redis.service';
import { resolveDateRange } from '../../common/utils/date-range.util';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

type UsersAnalyticsRow = {
  user_id: string;
  email: string;
  name: string;
  phone: string;
  is_active: number;
  orders_count: number;
  total_spent: number;
  total_discount: number;
  promo_usages: number;
};

type PromocodesAnalyticsRow = {
  promocode_id: string;
  code: string;
  discount_percent: number;
  is_active: number;
  usages: number;
  revenue: number;
  total_discount: number;
  unique_users: number;
};

type PromoUsageRow = {
  usage_id: string;
  promocode_id: string;
  promo_code: string;
  user_id: string;
  user_email: string;
  user_name: string;
  order_id: string;
  order_amount: number;
  discount_amount: number;
  created_at: string;
};

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly clickhouseService: ClickhouseService,
    private readonly redisService: RedisService
  ) {}

  async getUsersAnalytics(query: AnalyticsQueryDto) {
    return this.cached(`analytics:users`, query, async () => {
      const { dateFrom, dateTo } = resolveDateRange(query.dateFrom, query.dateTo);
      const sortBy = this.mapSort(query.sortBy, [
        'email',
        'name',
        'phone',
        'is_active',
        'orders_count',
        'total_spent',
        'total_discount',
        'promo_usages'
      ]);
      const sortOrder = query.sortOrder ?? 'desc';
      const params: Record<string, unknown> = {
        dateFrom,
        dateTo,
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize
      };
      const filters: string[] = [];

      this.addLikeFilter(filters, params, 'u.email', 'email', query.email);
      this.addLikeFilter(filters, params, 'u.name', 'name', query.name);
      this.addLikeFilter(filters, params, 'u.phone', 'phone', query.phone);
      this.addStatusFilter(filters, params, 'u.is_active', 'status', query.status);
      const whereClause = this.toWhereClause(filters);

      const dataQuery = `
        SELECT
          u.user_id AS user_id,
          u.email AS email,
          u.name AS name,
          u.phone AS phone,
          u.is_active AS is_active,
          ifNull(o.orders_count, toUInt32(0)) AS orders_count,
          ifNull(o.total_spent, toFloat64(0)) AS total_spent,
          ifNull(o.total_discount, toFloat64(0)) AS total_discount,
          ifNull(pu.promo_usages, toUInt32(0)) AS promo_usages
        FROM (
          SELECT *
          FROM users FINAL
        ) AS u
        LEFT JOIN (
          SELECT
            user_id,
            toUInt32(uniqExact(order_id)) AS orders_count,
            toFloat64(sum(amount)) AS total_spent,
            toFloat64(sum(discount_amount)) AS total_discount
          FROM orders FINAL
          WHERE created_at BETWEEN toDateTime({dateFrom:String}) AND toDateTime({dateTo:String})
          GROUP BY user_id
        ) o
          ON u.user_id = o.user_id
        LEFT JOIN (
          SELECT
            user_id,
            toUInt32(uniqExact(usage_id)) AS promo_usages
          FROM promo_usages
          WHERE created_at BETWEEN toDateTime({dateFrom:String}) AND toDateTime({dateTo:String})
          GROUP BY user_id
        ) pu
          ON u.user_id = pu.user_id
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT {limit:UInt32}
        OFFSET {offset:UInt32}
      `;

      const totalQuery = `
        SELECT toUInt32(count()) AS total
        FROM (
          SELECT *
          FROM users FINAL
        ) AS u
        ${whereClause}
      `;

      const [rows, totalRows] = await Promise.all([
        this.clickhouseService.query<UsersAnalyticsRow>(dataQuery, params),
        this.clickhouseService.query<{ total: number }>(totalQuery, params)
      ]);

      return this.wrap(rows, totalRows[0]?.total ?? 0, query);
    });
  }

  async getPromocodesAnalytics(query: AnalyticsQueryDto) {
    return this.cached(`analytics:promocodes`, query, async () => {
      const { dateFrom, dateTo } = resolveDateRange(query.dateFrom, query.dateTo);
      const sortBy = this.mapSort(query.sortBy, [
        'code',
        'discount_percent',
        'is_active',
        'usages',
        'revenue',
        'total_discount',
        'unique_users'
      ]);
      const sortOrder = query.sortOrder ?? 'desc';
      const params: Record<string, unknown> = {
        dateFrom,
        dateTo,
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize
      };
      const filters: string[] = [];

      this.addLikeFilter(filters, params, 'p.code', 'code', query.code);
      this.addStatusFilter(filters, params, 'p.is_active', 'status', query.status);
      const whereClause = this.toWhereClause(filters);

      const dataQuery = `
        SELECT
          p.promocode_id AS promocode_id,
          p.code AS code,
          p.discount_percent AS discount_percent,
          p.is_active AS is_active,
          ifNull(pu.usages, toUInt32(0)) AS usages,
          ifNull(pu.revenue, toFloat64(0)) AS revenue,
          ifNull(pu.total_discount, toFloat64(0)) AS total_discount,
          ifNull(pu.unique_users, toUInt32(0)) AS unique_users
        FROM (
          SELECT *
          FROM promocodes FINAL
        ) AS p
        LEFT JOIN (
          SELECT
            promocode_id,
            toUInt32(uniqExact(usage_id)) AS usages,
            toFloat64(sum(order_amount)) AS revenue,
            toFloat64(sum(discount_amount)) AS total_discount,
            toUInt32(uniqExact(user_id)) AS unique_users
          FROM promo_usages
          WHERE created_at BETWEEN toDateTime({dateFrom:String}) AND toDateTime({dateTo:String})
          GROUP BY promocode_id
        ) pu
          ON p.promocode_id = pu.promocode_id
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT {limit:UInt32}
        OFFSET {offset:UInt32}
      `;

      const totalQuery = `
        SELECT toUInt32(count()) AS total
        FROM (
          SELECT *
          FROM promocodes FINAL
        ) AS p
        ${whereClause}
      `;

      const [rows, totalRows] = await Promise.all([
        this.clickhouseService.query<PromocodesAnalyticsRow>(dataQuery, params),
        this.clickhouseService.query<{ total: number }>(totalQuery, params)
      ]);

      return this.wrap(rows, totalRows[0]?.total ?? 0, query);
    });
  }

  async getPromoUsages(query: AnalyticsQueryDto) {
    return this.cached(`analytics:promo-usages`, query, async () => {
      const { dateFrom, dateTo } = resolveDateRange(query.dateFrom, query.dateTo);
      const sortBy = this.mapSort(query.sortBy, [
        'promo_code',
        'user_email',
        'user_name',
        'order_amount',
        'discount_amount',
        'created_at'
      ]);
      const sortOrder = query.sortOrder ?? 'desc';
      const params: Record<string, unknown> = {
        dateFrom,
        dateTo,
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize
      };
      const filters = [
        'created_at BETWEEN toDateTime({dateFrom:String}) AND toDateTime({dateTo:String})'
      ];

      this.addLikeFilter(filters, params, 'promo_code', 'promoCode', query.promoCode);
      this.addLikeFilter(filters, params, 'user_email', 'userEmail', query.userEmail);
      this.addLikeFilter(filters, params, 'user_name', 'userName', query.userName);
      this.addGlobalUsageSearch(filters, params, query.search);
      const whereClause = this.toWhereClause(filters);

      const dataQuery = `
        SELECT
          usage_id,
          promocode_id,
          promo_code,
          user_id,
          user_email,
          user_name,
          order_id,
          order_amount,
          discount_amount,
          created_at
        FROM promo_usages
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT {limit:UInt32}
        OFFSET {offset:UInt32}
      `;

      const totalQuery = `
        SELECT toUInt32(count()) AS total
        FROM promo_usages
        ${whereClause}
      `;

      const [rows, totalRows] = await Promise.all([
        this.clickhouseService.query<PromoUsageRow>(dataQuery, params),
        this.clickhouseService.query<{ total: number }>(totalQuery, params)
      ]);

      return this.wrap(rows, totalRows[0]?.total ?? 0, query);
    });
  }

  private async cached<T>(prefix: string, query: AnalyticsQueryDto, resolver: () => Promise<T>) {
    const cacheKey = `${prefix}:${this.hashQuery(query)}`;
    const cached = await this.redisService.getJson<T>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await resolver();
    await this.redisService.setJson(cacheKey, result, this.redisService.getAnalyticsCacheTtl());
    return result;
  }

  private wrap<T>(rows: T[], total: number, query: AnalyticsQueryDto) {
    const normalizedTotal = Number(total);

    return {
      data: rows,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: normalizedTotal,
        totalPages: Math.ceil(normalizedTotal / query.pageSize)
      }
    };
  }

  private mapSort(input: string | undefined, allowed: string[]): string {
    if (!input) {
      return allowed[0] ?? 'created_at';
    }

    if (!allowed.includes(input)) {
      throw new BadRequestException('Invalid sort column');
    }

    return input;
  }

  private hashQuery(query: AnalyticsQueryDto): string {
    return Buffer.from(JSON.stringify(query)).toString('base64url');
  }

  private addLikeFilter(
    filters: string[],
    params: Record<string, unknown>,
    column: string,
    paramKey: string,
    value?: string
  ): void {
    const normalized = value?.trim();
    if (!normalized) {
      return;
    }

    filters.push(`${column} ILIKE {${paramKey}:String}`);
    params[paramKey] = `%${normalized}%`;
  }

  private addStatusFilter(
    filters: string[],
    params: Record<string, unknown>,
    column: string,
    paramKey: string,
    status?: 'active' | 'inactive'
  ): void {
    if (!status) {
      return;
    }

    filters.push(`${column} = {${paramKey}:UInt8}`);
    params[paramKey] = status === 'active' ? 1 : 0;
  }

  private addGlobalUsageSearch(
    filters: string[],
    params: Record<string, unknown>,
    search?: string
  ): void {
    const normalized = search?.trim();
    if (!normalized) {
      return;
    }

    filters.push(
      '(promo_code ILIKE {search:String} OR user_email ILIKE {search:String} OR user_name ILIKE {search:String})'
    );
    params.search = `%${normalized}%`;
  }

  private toWhereClause(filters: string[]): string {
    return filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  }
}
