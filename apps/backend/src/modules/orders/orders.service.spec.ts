import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';

import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const userId = new Types.ObjectId().toHexString();
  const promoId = new Types.ObjectId();
  const orderId = new Types.ObjectId();

  const createMocks = () => {
    const orderModel = {
      create: jest.fn(),
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateOne: jest.fn()
    };
    const promoUsageModel = {
      countDocuments: jest.fn(),
      create: jest.fn(),
      deleteOne: jest.fn()
    };
    const promoModel = {
      findOne: jest.fn(),
      updateOne: jest.fn()
    };
    const userModel = {
      findById: jest.fn()
    };
    const redisService = {
      acquireLock: jest.fn(),
      releaseLock: jest.fn(),
      invalidateAnalyticsCache: jest.fn()
    };
    const syncService = {
      syncOrder: jest.fn(),
      syncPromocode: jest.fn(),
      syncPromoUsage: jest.fn()
    };
    const clickhouseService = {
      query: jest.fn()
    };

    const promoDoc: {
      _id: Types.ObjectId;
      code: string;
      discountPercent: number;
      totalUsageLimit: number;
      perUserUsageLimit: number;
      usedCount: number;
      isActive: boolean;
      dateFrom: Date | null;
      dateTo: Date | null;
      save: jest.Mock;
    } = {
      _id: promoId,
      code: 'SAVE10',
      discountPercent: 10,
      totalUsageLimit: 5,
      perUserUsageLimit: 1,
      usedCount: 0,
      isActive: true,
      dateFrom: null,
      dateTo: null,
      save: jest.fn()
    };

    const orderDoc: {
      _id: Types.ObjectId;
      userId: string;
      amount: number;
      finalAmount: number;
      promoCodeId: Types.ObjectId | null;
      promoCodeCode: string | null;
      discountAmount: number;
    } = {
      _id: orderId,
      userId,
      amount: 100,
      finalAmount: 100,
      promoCodeId: null,
      promoCodeCode: null,
      discountAmount: 0
    };

    promoUsageModel.countDocuments.mockResolvedValue(0);
    redisService.acquireLock.mockResolvedValue('token');

    return {
      orderModel,
      promoUsageModel,
      promoModel,
      userModel,
      redisService,
      syncService,
      clickhouseService,
      promoDoc,
      orderDoc
    };
  };

  it('rejects create order with non-positive amount', async () => {
    const mocks = createMocks();
    const service = new OrdersService(
      mocks.orderModel as never,
      mocks.promoUsageModel as never,
      mocks.promoModel as never,
      mocks.userModel as never,
      mocks.redisService as never,
      mocks.syncService as never,
      mocks.clickhouseService as never
    );

    await expect(
      service.createOrder({ sub: userId, email: 'x@y.com', role: 'user' }, { amount: -5 })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates order and syncs when user exists', async () => {
    const mocks = createMocks();
    const createdOrder = { _id: orderId, userId, amount: 100, finalAmount: 100 };
    mocks.orderModel.create.mockResolvedValue(createdOrder);
    mocks.userModel.findById.mockResolvedValue({ _id: userId });

    const service = new OrdersService(
      mocks.orderModel as never,
      mocks.promoUsageModel as never,
      mocks.promoModel as never,
      mocks.userModel as never,
      mocks.redisService as never,
      mocks.syncService as never,
      mocks.clickhouseService as never
    );

    const result = await service.createOrder(
      { sub: userId, email: 'x@y.com', role: 'user' },
      { amount: 100 }
    );

    expect(result).toEqual(createdOrder);
    expect(mocks.syncService.syncOrder).toHaveBeenCalled();
    expect(mocks.redisService.invalidateAnalyticsCache).toHaveBeenCalled();
  });

  it('lists orders from ClickHouse read model', async () => {
    const mocks = createMocks();
    mocks.clickhouseService.query
      .mockResolvedValueOnce([
        {
          order_id: orderId.toHexString(),
          amount: 100,
          final_amount: 100,
          promocode_id: null,
          promocode_code: null,
          discount_amount: 0,
          created_at: '2026-04-15 10:00:00',
          updated_at: '2026-04-15 10:00:00'
        }
      ])
      .mockResolvedValueOnce([{ total: 1 }]);

    const service = new OrdersService(
      mocks.orderModel as never,
      mocks.promoUsageModel as never,
      mocks.promoModel as never,
      mocks.userModel as never,
      mocks.redisService as never,
      mocks.syncService as never,
      mocks.clickhouseService as never
    );

    const result = await service.listMyOrders(
      { sub: userId, email: 'x@y.com', role: 'user' },
      { page: 1, pageSize: 10 }
    );

    expect(mocks.clickhouseService.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('FROM orders FINAL'),
      expect.objectContaining({
        userId,
        limit: 10,
        offset: 0
      })
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        _id: orderId.toHexString(),
        amount: 100
      })
    );
  });

  it('rejects apply promo when lock not acquired', async () => {
    const mocks = createMocks();
    mocks.promoModel.findOne.mockResolvedValue(mocks.promoDoc);
    mocks.redisService.acquireLock.mockResolvedValue(null);

    const service = new OrdersService(
      mocks.orderModel as never,
      mocks.promoUsageModel as never,
      mocks.promoModel as never,
      mocks.userModel as never,
      mocks.redisService as never,
      mocks.syncService as never,
      mocks.clickhouseService as never
    );

    await expect(
      service.applyPromoCode(
        { sub: userId, email: 'x@y.com', role: 'user' },
        orderId.toHexString(),
        {
          promoCode: 'SAVE10'
        }
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects apply promo when promo is inactive', async () => {
    const mocks = createMocks();
    mocks.promoDoc.isActive = false;
    mocks.promoModel.findOne.mockResolvedValue(mocks.promoDoc);
    mocks.orderModel.findById.mockResolvedValue(mocks.orderDoc);

    const service = new OrdersService(
      mocks.orderModel as never,
      mocks.promoUsageModel as never,
      mocks.promoModel as never,
      mocks.userModel as never,
      mocks.redisService as never,
      mocks.syncService as never,
      mocks.clickhouseService as never
    );

    await expect(
      service.applyPromoCode(
        { sub: userId, email: 'x@y.com', role: 'user' },
        orderId.toHexString(),
        {
          promoCode: 'SAVE10'
        }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects apply promo when promo expired', async () => {
    const mocks = createMocks();
    mocks.promoDoc.dateTo = new Date('2000-01-01');
    mocks.promoModel.findOne.mockResolvedValue(mocks.promoDoc);
    mocks.orderModel.findById.mockResolvedValue(mocks.orderDoc);

    const service = new OrdersService(
      mocks.orderModel as never,
      mocks.promoUsageModel as never,
      mocks.promoModel as never,
      mocks.userModel as never,
      mocks.redisService as never,
      mocks.syncService as never,
      mocks.clickhouseService as never
    );

    await expect(
      service.applyPromoCode(
        { sub: userId, email: 'x@y.com', role: 'user' },
        orderId.toHexString(),
        {
          promoCode: 'SAVE10'
        }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects apply promo when usage limit exceeded', async () => {
    const mocks = createMocks();
    mocks.promoDoc.usedCount = 5;
    mocks.promoDoc.totalUsageLimit = 5;
    mocks.promoModel.findOne.mockResolvedValue(mocks.promoDoc);
    mocks.orderModel.findById.mockResolvedValue(mocks.orderDoc);

    const service = new OrdersService(
      mocks.orderModel as never,
      mocks.promoUsageModel as never,
      mocks.promoModel as never,
      mocks.userModel as never,
      mocks.redisService as never,
      mocks.syncService as never,
      mocks.clickhouseService as never
    );

    await expect(
      service.applyPromoCode(
        { sub: userId, email: 'x@y.com', role: 'user' },
        orderId.toHexString(),
        {
          promoCode: 'SAVE10'
        }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects apply promo when per-user limit exceeded', async () => {
    const mocks = createMocks();
    mocks.promoDoc.perUserUsageLimit = 1;
    mocks.promoModel.findOne.mockResolvedValue(mocks.promoDoc);
    mocks.orderModel.findById.mockResolvedValue(mocks.orderDoc);
    mocks.promoUsageModel.countDocuments.mockResolvedValue(1);

    const service = new OrdersService(
      mocks.orderModel as never,
      mocks.promoUsageModel as never,
      mocks.promoModel as never,
      mocks.userModel as never,
      mocks.redisService as never,
      mocks.syncService as never,
      mocks.clickhouseService as never
    );

    await expect(
      service.applyPromoCode(
        { sub: userId, email: 'x@y.com', role: 'user' },
        orderId.toHexString(),
        {
          promoCode: 'SAVE10'
        }
      )
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mocks.promoUsageModel.countDocuments).toHaveBeenCalledWith({
      promoCodeId: promoId,
      userId: expect.any(Types.ObjectId)
    });
  });

  it('rejects apply promo when already applied', async () => {
    const mocks = createMocks();
    mocks.orderDoc.promoCodeId = new Types.ObjectId();
    mocks.promoModel.findOne.mockResolvedValue(mocks.promoDoc);
    mocks.orderModel.findById.mockResolvedValue(mocks.orderDoc);

    const service = new OrdersService(
      mocks.orderModel as never,
      mocks.promoUsageModel as never,
      mocks.promoModel as never,
      mocks.userModel as never,
      mocks.redisService as never,
      mocks.syncService as never,
      mocks.clickhouseService as never
    );

    await expect(
      service.applyPromoCode(
        { sub: userId, email: 'x@y.com', role: 'user' },
        orderId.toHexString(),
        {
          promoCode: 'SAVE10'
        }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
