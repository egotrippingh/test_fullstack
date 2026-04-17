import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { CreatePromoCodeDto } from './dto/create-promocode.dto';
import { UpdatePromoCodeDto } from './dto/update-promocode.dto';
import { PromocodesService } from './promocodes.service';

@ApiTags('promocodes')
@ApiBearerAuth()
@Controller('promocodes')
export class PromocodesController {
  constructor(private readonly promocodesService: PromocodesService) {}

  @Post()
  @ApiOkResponse({ description: 'Создание промокода' })
  async create(@Body() dto: CreatePromoCodeDto) {
    return this.promocodesService.create(dto);
  }

  @Get()
  async list(@Query() query: PaginationQueryDto): Promise<PaginatedResponse<unknown>> {
    const { items, total } = await this.promocodesService.list(query);
    return {
      data: items,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize)
      }
    };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.promocodesService.findById(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePromoCodeDto) {
    return this.promocodesService.update(id, dto);
  }

  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string) {
    return this.promocodesService.deactivate(id);
  }
}
