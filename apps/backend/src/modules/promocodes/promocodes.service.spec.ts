import { BadRequestException } from '@nestjs/common';

import { PromocodesService } from './promocodes.service';

describe('PromocodesService', () => {
  const promoModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn()
  };
  const syncService = {
    syncPromocode: jest.fn(),
    syncPromocodeRelations: jest.fn()
  };
  const redisService = {
    invalidateAnalyticsCache: jest.fn()
  };
  const clickhouseService = {
    query: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects create when date range is invalid', async () => {
    promoModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    });
    const service = new PromocodesService(
      promoModel as never,
      syncService as never,
      redisService as never,
      clickhouseService as never
    );

    await expect(
      service.create({
        code: 'SAVE10',
        discountPercent: 10,
        totalUsageLimit: 10,
        perUserUsageLimit: 1,
        dateFrom: '2024-12-10',
        dateTo: '2024-01-01',
        isActive: true
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects create when promo code already exists', async () => {
    promoModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: 'existing' })
    });
    const service = new PromocodesService(
      promoModel as never,
      syncService as never,
      redisService as never,
      clickhouseService as never
    );

    await expect(
      service.create({
        code: 'SAVE10',
        discountPercent: 10,
        totalUsageLimit: 10,
        perUserUsageLimit: 1,
        isActive: true
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects update when date range is invalid', async () => {
    const promoDoc = {
      _id: 'promo-id',
      code: 'SAVE10',
      discountPercent: 10,
      totalUsageLimit: 10,
      perUserUsageLimit: 1,
      dateFrom: new Date('2024-01-01'),
      dateTo: new Date('2024-12-01'),
      isActive: true,
      save: jest.fn()
    };
    promoModel.findById.mockResolvedValue(promoDoc);

    const service = new PromocodesService(
      promoModel as never,
      syncService as never,
      redisService as never,
      clickhouseService as never
    );

    await expect(
      service.update('promo-id', {
        dateFrom: '2024-12-10',
        dateTo: '2024-01-01'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('invalidates analytics cache after create', async () => {
    promoModel.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    });
    promoModel.create.mockResolvedValue({ _id: 'promo-id' });

    const service = new PromocodesService(
      promoModel as never,
      syncService as never,
      redisService as never,
      clickhouseService as never
    );

    await service.create({
      code: 'SAVE10',
      discountPercent: 10,
      totalUsageLimit: 10,
      perUserUsageLimit: 1,
      isActive: true
    });

    expect(syncService.syncPromocode).toHaveBeenCalled();
    expect(redisService.invalidateAnalyticsCache).toHaveBeenCalled();
  });
});
