import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { ApplyPromoCodeDto } from './dto/apply-promocode.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOkResponse({ description: 'Создание заказа' })
  async createOrder(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(user, dto);
  }

  @Get('my')
  async listMyOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto
  ): Promise<PaginatedResponse<unknown>> {
    const { items, total } = await this.ordersService.listMyOrders(user, query);
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
  async getOrder(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.getOrderById(user, id);
  }

  @Post(':id/apply-promocode')
  @ApiOkResponse({ description: 'Применение промокода к заказу' })
  async applyPromo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ApplyPromoCodeDto
  ) {
    return this.ordersService.applyPromoCode(user, id, dto);
  }
}
