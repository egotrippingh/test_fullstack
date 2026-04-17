import { Body, Controller, ForbiddenException, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOkResponse({ description: 'Текущий пользователь' })
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
    const doc = await this.usersService.findById(user.sub);
    return this.toResponse(doc);
  }

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto
  ): Promise<PaginatedResponse<UserResponseDto>> {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    const { items, total } = await this.usersService.list(query);

    return {
      data: items.map((doc) => this.toResponse(doc)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize)
      }
    };
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<UserResponseDto> {
    if (user.sub !== id && user.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    const doc = await this.usersService.findById(id);
    return this.toResponse(doc);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<UserResponseDto> {
    const doc = await this.usersService.update(id, dto, user);
    return this.toResponse(doc);
  }

  @Patch(':id/deactivate')
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<UserResponseDto> {
    const doc = await this.usersService.deactivate(id, user);
    return this.toResponse(doc);
  }

  private toResponse(doc: { _id: unknown; email: string; name: string; phone: string; role: 'admin' | 'user'; isActive: boolean; createdAt: Date; updatedAt: Date }): UserResponseDto {
    return {
      _id: String(doc._id),
      id: String(doc._id),
      email: doc.email,
      name: doc.name,
      phone: doc.phone,
      role: doc.role,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }
}
