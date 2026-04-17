import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('users')
  async users(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getUsersAnalytics(query);
  }

  @Get('promocodes')
  async promocodes(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getPromocodesAnalytics(query);
  }

  @Get('promo-usages')
  async promoUsages(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getPromoUsages(query);
  }
}
