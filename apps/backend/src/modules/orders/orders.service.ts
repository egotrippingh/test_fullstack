import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ClickhouseService } from '../clickhouse/clickhouse.service';
import { RedisService } from '../redis/redis.service';
import { SyncService } from '../sync/sync.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { PromoCode, PromoCodeDocument } from '../promocodes/schemas/promocode.schema';
import { ApplyPromoCodeDto } from './dto/apply-promocode.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderDocument } from './schemas/order.schema';
import { PromoUsage, PromoUsageDocument } from './schemas/promo-usage.schema';

type OrderListRow = {
  order_id: string;
  amount: number;
  final_amount: number;
  promocode_id: string | null;
  promocode_code: string | null;
  discount_amount: number;
  created_at: string;
  updated_at: string;
};

type OrderListItem = {
  _id: string;
  amount: number;
  finalAmount: number;
  promoCodeId: string | null;
  promoCodeCode: string | null;
  discountAmount: number;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(PromoUsage.name) private readonly promoUsageModel: Model<PromoUsageDocument>,
    @InjectModel(PromoCode.name) private readonly promoModel: Model<PromoCodeDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly redisService: RedisService,
    private readonly syncService: SyncService,
    private readonly clickhouseService: ClickhouseService
  ) {}

  async createOrder(user: AuthenticatedUser, dto: CreateOrderDto): Promise<OrderDocument> {
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const order = await this.orderModel.create({
      userId: new Types.ObjectId(user.sub),
      amount,
      finalAmount: amount,
      promoCodeId: null,
      promoCodeCode: null,
      discountAmount: 0
    });

    const userDoc = await this.userModel.findById(user.sub);
    if (userDoc) {
      await this.syncService.syncOrder(order, userDoc);
    }
    await this.redisService.invalidateAnalyticsCache();

    return order;
  }

  async listMyOrders(
    user: AuthenticatedUser,
    query: PaginationQueryDto
  ): Promise<{ items: OrderListItem[]; total: number }> {
    const [items, total] = await Promise.all([
      this.clickhouseService.query<OrderListRow>(
        `
          SELECT
            order_id,
            amount,
            final_amount,
            promocode_id,
            promocode_code,
            discount_amount,
            created_at,
            updated_at
          FROM orders FINAL
          WHERE user_id = {userId:String}
          ORDER BY created_at DESC
          LIMIT {limit:UInt32}
          OFFSET {offset:UInt32}
        `,
        {
          userId: user.sub,
          limit: query.pageSize,
          offset: (query.page - 1) * query.pageSize
        }
      ),
      this.clickhouseService.query<{ total: number }>(
        `
          SELECT toUInt32(count()) AS total
          FROM orders FINAL
          WHERE user_id = {userId:String}
        `,
        {
          userId: user.sub
        }
      )
    ]);

    return {
      items: items.map((row) => ({
        _id: row.order_id,
        amount: row.amount,
        finalAmount: row.final_amount,
        promoCodeId: row.promocode_id,
        promoCodeCode: row.promocode_code,
        discountAmount: row.discount_amount,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })),
      total: total[0]?.total ?? 0
    };
  }

  async getOrderById(user: AuthenticatedUser, id: string): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid order id');
    }

    const order = await this.orderModel.findById(id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (String(order.userId) !== user.sub) {
      throw new ForbiddenException('Access denied');
    }

    return order;
  }

  async applyPromoCode(
    user: AuthenticatedUser,
    orderId: string,
    dto: ApplyPromoCodeDto
  ): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new BadRequestException('Invalid order id');
    }

    const promoCodeValue = dto.promoCode.trim().toUpperCase();
    const promo = await this.promoModel.findOne({ code: promoCodeValue });
    if (!promo) {
      throw new NotFoundException('Promo code not found');
    }

    const lockKey = `lock:promocode:${promo._id}`;
    const lockToken = await this.redisService.acquireLock(lockKey);
    if (!lockToken) {
      throw new ConflictException('Promo code is busy, retry');
    }

    let originalAmount: number | null = null;
    let updatedOrder: OrderDocument | null = null;
    let usage: PromoUsageDocument | null = null;
    let promoUsageIncremented = false;

    try {
      const order = await this.orderModel.findById(orderId);
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      originalAmount = order.amount;
      if (String(order.userId) !== user.sub) {
        throw new ForbiddenException('Access denied');
      }

      if (order.promoCodeId) {
        throw new BadRequestException('Promo code already applied to order');
      }

      if (!promo.isActive) {
        throw new BadRequestException('Promo code is inactive');
      }

      const now = new Date();
      if (promo.dateFrom && now < promo.dateFrom) {
        throw new BadRequestException('Promo code is not active yet');
      }
      if (promo.dateTo && now > promo.dateTo) {
        throw new BadRequestException('Promo code has expired');
      }

      if (promo.totalUsageLimit <= 0) {
        throw new BadRequestException('Promo code usage limit is zero');
      }
      if (promo.usedCount >= promo.totalUsageLimit) {
        throw new BadRequestException('Promo code usage limit exceeded');
      }

      if (promo.perUserUsageLimit <= 0) {
        throw new BadRequestException('Promo code per-user limit is zero');
      }

      const userUsageCount = await this.promoUsageModel.countDocuments({
        promoCodeId: promo._id,
        userId: new Types.ObjectId(user.sub)
      });

      if (userUsageCount >= promo.perUserUsageLimit) {
        throw new BadRequestException('Promo code per-user limit exceeded');
      }

      const userDoc = await this.userModel.findById(user.sub);
      if (!userDoc) {
        throw new NotFoundException('User not found');
      }

      const discountAmount = Number((order.amount * promo.discountPercent / 100).toFixed(2));
      const finalAmount = Math.max(0, Number((order.amount - discountAmount).toFixed(2)));

      updatedOrder = await this.orderModel.findOneAndUpdate(
        { _id: order._id, promoCodeId: null },
        {
          $set: {
            promoCodeId: promo._id,
            promoCodeCode: promo.code,
            discountAmount,
            finalAmount
          }
        },
        { new: true }
      );

      if (!updatedOrder) {
        throw new ConflictException('Promo code already applied');
      }

      promo.usedCount += 1;
      await promo.save();
      promoUsageIncremented = true;

      usage = await this.promoUsageModel.create({
        promoCodeId: promo._id,
        promoCodeCode: promo.code,
        userId: new Types.ObjectId(user.sub),
        orderId: order._id,
        orderAmount: order.amount,
        discountAmount
      });

      await this.syncService.syncOrder(updatedOrder, userDoc, promo);
      await this.syncService.syncPromocode(promo);
      await this.syncService.syncPromoUsage(usage, userDoc, promo, updatedOrder);

      await this.redisService.invalidateAnalyticsCache();

      return updatedOrder;
    } catch (error) {
      await this.rollbackPromoApplication(
        orderId,
        promo._id,
        originalAmount,
        updatedOrder,
        usage,
        promoUsageIncremented
      );
      throw error;
    } finally {
      await this.redisService.releaseLock(lockKey, lockToken);
    }
  }

  private async rollbackPromoApplication(
    orderId: string,
    promoId: Types.ObjectId,
    originalAmount: number | null,
    updatedOrder: OrderDocument | null,
    usage: PromoUsageDocument | null,
    promoUsageIncremented: boolean
  ): Promise<void> {
    const rollbackOperations: Promise<unknown>[] = [];

    if (usage) {
      rollbackOperations.push(this.promoUsageModel.deleteOne({ _id: usage._id }));
    }

    if (updatedOrder && originalAmount !== null) {
      rollbackOperations.push(
        this.orderModel.updateOne(
          { _id: orderId },
          {
            $set: {
              promoCodeId: null,
              promoCodeCode: null,
              discountAmount: 0,
              finalAmount: originalAmount
            }
          }
        )
      );
    }

    if (promoUsageIncremented) {
      rollbackOperations.push(
        this.promoModel.updateOne(
          { _id: promoId, usedCount: { $gt: 0 } },
          {
            $inc: {
              usedCount: -1
            }
          }
        )
      );
    }

    if (rollbackOperations.length > 0) {
      await Promise.allSettled(rollbackOperations);
    }
  }
}
