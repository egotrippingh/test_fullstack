import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ClickhouseService } from '../clickhouse/clickhouse.service';
import { RedisService } from '../redis/redis.service';
import { SyncService } from '../sync/sync.service';
import { CreatePromoCodeDto } from './dto/create-promocode.dto';
import { UpdatePromoCodeDto } from './dto/update-promocode.dto';
import { PromoCode, PromoCodeDocument } from './schemas/promocode.schema';

type PromoCodeListRow = {
  promocode_id: string;
  code: string;
  discount_percent: number;
  total_usage_limit: number;
  per_user_usage_limit: number;
  used_count: number;
  date_from: string | null;
  date_to: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

type PromoCodeListItem = {
  _id: string;
  code: string;
  discountPercent: number;
  totalUsageLimit: number;
  perUserUsageLimit: number;
  usedCount: number;
  dateFrom: string | null;
  dateTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class PromocodesService {
  constructor(
    @InjectModel(PromoCode.name) private readonly promoModel: Model<PromoCodeDocument>,
    private readonly syncService: SyncService,
    private readonly redisService: RedisService,
    private readonly clickhouseService: ClickhouseService
  ) {}

  async create(dto: CreatePromoCodeDto): Promise<PromoCodeDocument> {
    const normalizedCode = dto.code.trim().toUpperCase();
    const existing = await this.promoModel.findOne({ code: normalizedCode }).lean();
    if (existing) {
      throw new BadRequestException('Promo code already exists');
    }

    if (dto.dateFrom && dto.dateTo && new Date(dto.dateFrom) > new Date(dto.dateTo)) {
      throw new BadRequestException('dateFrom must be earlier than dateTo');
    }

    const promo = await this.promoModel.create({
      code: normalizedCode,
      discountPercent: dto.discountPercent,
      totalUsageLimit: dto.totalUsageLimit,
      perUserUsageLimit: dto.perUserUsageLimit,
      usedCount: 0,
      dateFrom: dto.dateFrom ? new Date(dto.dateFrom) : null,
      dateTo: dto.dateTo ? new Date(dto.dateTo) : null,
      isActive: dto.isActive ?? true
    });

    await this.syncService.syncPromocode(promo);
    await this.redisService.invalidateAnalyticsCache();
    return promo;
  }

  async findById(id: string): Promise<PromoCodeDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid promo code id');
    }

    const promo = await this.promoModel.findById(id);
    if (!promo) {
      throw new NotFoundException('Promo code not found');
    }

    return promo;
  }

  async findByCode(code: string): Promise<PromoCodeDocument | null> {
    return this.promoModel.findOne({ code: code.trim().toUpperCase() });
  }

  async list(query: PaginationQueryDto): Promise<{ items: PromoCodeListItem[]; total: number }> {
    const [items, total] = await Promise.all([
      this.clickhouseService.query<PromoCodeListRow>(
        `
          SELECT
            promocode_id,
            code,
            discount_percent,
            total_usage_limit,
            per_user_usage_limit,
            used_count,
            date_from,
            date_to,
            is_active,
            created_at,
            updated_at
          FROM promocodes FINAL
          ORDER BY created_at DESC
          LIMIT {limit:UInt32}
          OFFSET {offset:UInt32}
        `,
        {
          limit: query.pageSize,
          offset: (query.page - 1) * query.pageSize
        }
      ),
      this.clickhouseService.query<{ total: number }>(
        `
          SELECT toUInt32(count()) AS total
          FROM promocodes FINAL
        `
      )
    ]);

    return {
      items: items.map((row) => ({
        _id: row.promocode_id,
        code: row.code,
        discountPercent: row.discount_percent,
        totalUsageLimit: row.total_usage_limit,
        perUserUsageLimit: row.per_user_usage_limit,
        usedCount: row.used_count,
        dateFrom: row.date_from,
        dateTo: row.date_to,
        isActive: row.is_active === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      total: total[0]?.total ?? 0
    };
  }

  async update(id: string, dto: UpdatePromoCodeDto): Promise<PromoCodeDocument> {
    const promo = await this.findById(id);

    if (dto.code) {
      promo.code = dto.code.trim().toUpperCase();
    }

    if (dto.discountPercent !== undefined) promo.discountPercent = dto.discountPercent;
    if (dto.totalUsageLimit !== undefined) promo.totalUsageLimit = dto.totalUsageLimit;
    if (dto.perUserUsageLimit !== undefined) promo.perUserUsageLimit = dto.perUserUsageLimit;
    if (dto.dateFrom !== undefined) promo.dateFrom = dto.dateFrom ? new Date(dto.dateFrom) : null;
    if (dto.dateTo !== undefined) promo.dateTo = dto.dateTo ? new Date(dto.dateTo) : null;
    if (dto.isActive !== undefined) promo.isActive = dto.isActive;

    if (promo.dateFrom && promo.dateTo && promo.dateFrom > promo.dateTo) {
      throw new BadRequestException('dateFrom must be earlier than dateTo');
    }

    await promo.save();
    await this.syncService.syncPromocode(promo);
    await this.syncService.syncPromocodeRelations(promo);
    await this.redisService.invalidateAnalyticsCache();

    return promo;
  }

  async deactivate(id: string): Promise<PromoCodeDocument> {
    const promo = await this.findById(id);
    promo.isActive = false;
    await promo.save();
    await this.syncService.syncPromocode(promo);
    await this.syncService.syncPromocodeRelations(promo);
    await this.redisService.invalidateAnalyticsCache();

    return promo;
  }
}
