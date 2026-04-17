import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { ClickhouseService } from '../clickhouse/clickhouse.service';
import { OrderDocument } from '../orders/schemas/order.schema';
import { PromoUsageDocument } from '../orders/schemas/promo-usage.schema';
import { Order } from '../orders/schemas/order.schema';
import { PromoUsage } from '../orders/schemas/promo-usage.schema';
import { PromoCodeDocument } from '../promocodes/schemas/promocode.schema';
import { PromoCode } from '../promocodes/schemas/promocode.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { User } from '../users/schemas/user.schema';

type UserSnapshot = {
  _id: Types.ObjectId | string;
  email: string;
  name: string;
  phone: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type PromoSnapshot = {
  _id: Types.ObjectId | string;
  code: string;
  discountPercent: number;
  totalUsageLimit: number;
  perUserUsageLimit: number;
  usedCount: number;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type OrderSnapshot = {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  amount: number;
  finalAmount: number;
  promoCodeId: Types.ObjectId | string | null;
  promoCodeCode: string | null;
  discountAmount: number;
  createdAt: Date;
  updatedAt: Date;
};

type PromoUsageSnapshot = {
  _id: Types.ObjectId | string;
  promoCodeId: Types.ObjectId | string;
  promoCodeCode: string;
  userId: Types.ObjectId | string;
  orderId: Types.ObjectId | string;
  orderAmount: number;
  discountAmount: number;
  createdAt: Date;
};

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly clickhouseService: ClickhouseService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(PromoCode.name) private readonly promoModel: Model<PromoCodeDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(PromoUsage.name) private readonly promoUsageModel: Model<PromoUsageDocument>
  ) {}

  async syncUser(user: UserDocument): Promise<void> {
    await this.insertRowsWithRetry('users', [this.toUserRow(user)], 'sync user to ClickHouse');
  }

  async syncPromocode(promo: PromoCodeDocument): Promise<void> {
    await this.insertRowsWithRetry(
      'promocodes',
      [this.toPromocodeRow(promo)],
      'sync promocode to ClickHouse'
    );
  }

  async syncOrder(
    order: OrderDocument,
    user: UserDocument,
    promo?: PromoCodeDocument
  ): Promise<void> {
    await this.insertRowsWithRetry(
      'orders',
      [this.toOrderRow(order, user, promo)],
      'sync order to ClickHouse'
    );
  }

  async syncPromoUsage(
    usage: PromoUsageDocument,
    user: UserDocument,
    promo: PromoCodeDocument,
    order?: OrderDocument
  ): Promise<void> {
    await this.insertRowsWithRetry(
      'promo_usages',
      [this.toPromoUsageRow(usage, user, promo, order)],
      'sync promo usage to ClickHouse'
    );
  }

  async syncUserRelations(user: UserDocument): Promise<void> {
    const [orders, usages] = await Promise.all([
      this.orderModel.find({ userId: user._id }).lean<OrderSnapshot[]>().exec(),
      this.promoUsageModel.find({ userId: user._id }).lean<PromoUsageSnapshot[]>().exec()
    ]);

    await Promise.all([
      this.syncOrdersBatch(orders, new Map([[this.toIdString(user._id), user as UserSnapshot]])),
      this.syncPromoUsagesBatch(
        usages,
        new Map([[this.toIdString(user._id), user as UserSnapshot]])
      )
    ]);
  }

  async syncPromocodeRelations(promo: PromoCodeDocument): Promise<void> {
    const [orders, usages] = await Promise.all([
      this.orderModel.find({ promoCodeId: promo._id }).lean<OrderSnapshot[]>().exec(),
      this.promoUsageModel.find({ promoCodeId: promo._id }).lean<PromoUsageSnapshot[]>().exec()
    ]);

    await Promise.all([
      this.syncOrdersBatch(orders, undefined, new Map([[this.toIdString(promo._id), promo as PromoSnapshot]])),
      this.syncPromoUsagesBatch(
        usages,
        undefined,
        new Map([[this.toIdString(promo._id), promo as PromoSnapshot]])
      )
    ]);
  }

  async rebuildReadModel(): Promise<void> {
    const [users, promos, orders, usages] = await Promise.all([
      this.userModel.find().lean<UserSnapshot[]>().exec(),
      this.promoModel.find().lean<PromoSnapshot[]>().exec(),
      this.orderModel.find().lean<OrderSnapshot[]>().exec(),
      this.promoUsageModel.find().lean<PromoUsageSnapshot[]>().exec()
    ]);

    await this.truncateTables(['promo_usages', 'orders', 'promocodes', 'users']);

    const userMap = new Map(users.map((user) => [this.toIdString(user._id), user]));
    const promoMap = new Map(promos.map((promo) => [this.toIdString(promo._id), promo]));

    await this.insertRowsWithRetry(
      'users',
      users.map((user) => this.toUserRow(user)),
      'rebuild users read model'
    );
    await this.insertRowsWithRetry(
      'promocodes',
      promos.map((promo) => this.toPromocodeRow(promo)),
      'rebuild promocodes read model'
    );
    await this.syncOrdersBatch(orders, userMap, promoMap);
    await this.syncPromoUsagesBatch(usages, userMap, promoMap);

    this.logger.log(
      `Rebuilt ClickHouse read model: users=${users.length}, promocodes=${promos.length}, orders=${orders.length}, promo_usages=${usages.length}`
    );
  }

  private async syncOrdersBatch(
    orders: OrderSnapshot[],
    initialUsers?: Map<string, UserSnapshot>,
    initialPromos?: Map<string, PromoSnapshot>
  ): Promise<void> {
    if (orders.length === 0) {
      return;
    }

    const users = await this.loadUsersForOrders(orders, initialUsers);
    const promos = await this.loadPromosForOrders(orders, initialPromos);
    const rows = orders.flatMap((order) => {
      const user = users.get(this.toIdString(order.userId));
      if (!user) {
        return [];
      }

      const promoId = this.toOptionalIdString(order.promoCodeId);
      const promo = promoId ? promos.get(promoId) : undefined;
      return [this.toOrderRow(order, user, promo)];
    });

    await this.insertRowsWithRetry('orders', rows, 'sync order batch to ClickHouse');
  }

  private async syncPromoUsagesBatch(
    usages: PromoUsageSnapshot[],
    initialUsers?: Map<string, UserSnapshot>,
    initialPromos?: Map<string, PromoSnapshot>
  ): Promise<void> {
    if (usages.length === 0) {
      return;
    }

    const users = await this.loadUsersForUsages(usages, initialUsers);
    const promos = await this.loadPromosForUsages(usages, initialPromos);
    const rows = usages.flatMap((usage) => {
      const user = users.get(this.toIdString(usage.userId));
      const promo = promos.get(this.toIdString(usage.promoCodeId));
      if (!user || !promo) {
        return [];
      }

      return [this.toPromoUsageRow(usage, user, promo)];
    });

    await this.insertRowsWithRetry('promo_usages', rows, 'sync promo usage batch to ClickHouse');
  }

  private async loadUsersForOrders(
    orders: OrderSnapshot[],
    initialUsers = new Map<string, UserSnapshot>()
  ): Promise<Map<string, UserSnapshot>> {
    const missingIds = orders
      .map((order) => this.toIdString(order.userId))
      .filter((id, index, items) => !initialUsers.has(id) && items.indexOf(id) === index);

    if (missingIds.length === 0) {
      return initialUsers;
    }

    const users = await this.userModel
      .find({ _id: { $in: missingIds } })
      .lean<UserSnapshot[]>()
      .exec();

    users.forEach((user) => initialUsers.set(this.toIdString(user._id), user));
    return initialUsers;
  }

  private async loadPromosForOrders(
    orders: OrderSnapshot[],
    initialPromos = new Map<string, PromoSnapshot>()
  ): Promise<Map<string, PromoSnapshot>> {
    const missingIds = orders
      .map((order) => this.toOptionalIdString(order.promoCodeId))
      .filter((id): id is string => Boolean(id))
      .filter((id, index, items) => !initialPromos.has(id) && items.indexOf(id) === index);

    if (missingIds.length === 0) {
      return initialPromos;
    }

    const promos = await this.promoModel
      .find({ _id: { $in: missingIds } })
      .lean<PromoSnapshot[]>()
      .exec();

    promos.forEach((promo) => initialPromos.set(this.toIdString(promo._id), promo));
    return initialPromos;
  }

  private async loadUsersForUsages(
    usages: PromoUsageSnapshot[],
    initialUsers = new Map<string, UserSnapshot>()
  ): Promise<Map<string, UserSnapshot>> {
    const missingIds = usages
      .map((usage) => this.toIdString(usage.userId))
      .filter((id, index, items) => !initialUsers.has(id) && items.indexOf(id) === index);

    if (missingIds.length === 0) {
      return initialUsers;
    }

    const users = await this.userModel
      .find({ _id: { $in: missingIds } })
      .lean<UserSnapshot[]>()
      .exec();

    users.forEach((user) => initialUsers.set(this.toIdString(user._id), user));
    return initialUsers;
  }

  private async loadPromosForUsages(
    usages: PromoUsageSnapshot[],
    initialPromos = new Map<string, PromoSnapshot>()
  ): Promise<Map<string, PromoSnapshot>> {
    const missingIds = usages
      .map((usage) => this.toIdString(usage.promoCodeId))
      .filter((id, index, items) => !initialPromos.has(id) && items.indexOf(id) === index);

    if (missingIds.length === 0) {
      return initialPromos;
    }

    const promos = await this.promoModel
      .find({ _id: { $in: missingIds } })
      .lean<PromoSnapshot[]>()
      .exec();

    promos.forEach((promo) => initialPromos.set(this.toIdString(promo._id), promo));
    return initialPromos;
  }

  private toUserRow(user: UserSnapshot) {
    return {
      user_id: this.toIdString(user._id),
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      is_active: user.isActive ? 1 : 0,
      created_at: user.createdAt,
      updated_at: user.updatedAt
    };
  }

  private toPromocodeRow(promo: PromoSnapshot) {
    return {
      promocode_id: this.toIdString(promo._id),
      code: promo.code,
      discount_percent: promo.discountPercent,
      total_usage_limit: promo.totalUsageLimit,
      per_user_usage_limit: promo.perUserUsageLimit,
      used_count: promo.usedCount,
      date_from: promo.dateFrom ?? null,
      date_to: promo.dateTo ?? null,
      is_active: promo.isActive ? 1 : 0,
      created_at: promo.createdAt,
      updated_at: promo.updatedAt
    };
  }

  private toOrderRow(order: OrderSnapshot, user: UserSnapshot, promo?: PromoSnapshot) {
    return {
      order_id: this.toIdString(order._id),
      user_id: this.toIdString(order.userId),
      user_email: user.email,
      user_name: user.name,
      amount: order.amount,
      final_amount: order.finalAmount,
      promocode_id: this.toOptionalIdString(order.promoCodeId),
      promocode_code: order.promoCodeCode ?? promo?.code ?? null,
      discount_amount: order.discountAmount ?? 0,
      created_at: order.createdAt,
      updated_at: order.updatedAt
    };
  }

  private toPromoUsageRow(
    usage: PromoUsageSnapshot,
    user: UserSnapshot,
    promo: PromoSnapshot,
    order?: OrderSnapshot
  ) {
    return {
      usage_id: this.toIdString(usage._id),
      promocode_id: this.toIdString(promo._id),
      promo_code: promo.code,
      user_id: this.toIdString(user._id),
      user_email: user.email,
      user_name: user.name,
      order_id: this.toIdString(usage.orderId),
      order_amount: usage.orderAmount ?? order?.amount ?? 0,
      discount_amount: usage.discountAmount,
      created_at: usage.createdAt
    };
  }

  private async insertRowsWithRetry(
    table: string,
    rows: Record<string, unknown>[],
    label: string
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await this.runWithRetry(label, () => this.clickhouseService.insertRows(table, rows));
  }

  private async truncateTables(tables: string[]): Promise<void> {
    for (const table of tables) {
      await this.runWithRetry(`truncate ${table}`, async () => {
        await this.clickhouseService.command(`TRUNCATE TABLE IF EXISTS ${table}`);
      });
    }
  }

  private async runWithRetry(label: string, operation: () => Promise<void>): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await operation();
        return;
      } catch (error) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (attempt < 3) {
          this.logger.warn(`${label} failed on attempt ${attempt}, retrying: ${errorMessage}`);
          await this.delay(attempt * 200);
          continue;
        }
      }
    }

    const details =
      lastError instanceof Error ? lastError.stack ?? lastError.message : String(lastError);
    this.logger.error(`${label} failed after retries`, details);
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private toIdString(value: Types.ObjectId | string): string {
    return String(value);
  }

  private toOptionalIdString(value: Types.ObjectId | string | null | undefined): string | null {
    return value ? String(value) : null;
  }
}
