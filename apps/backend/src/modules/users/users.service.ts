import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { RedisService } from '../redis/redis.service';
import { SyncService } from '../sync/sync.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly syncService: SyncService,
    private readonly redisService: RedisService
  ) {}

  async create(dto: CreateUserDto, passwordHash: string): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ email: dto.email.toLowerCase() }).lean();
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const user = await this.userModel.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      name: dto.name,
      phone: dto.phone,
      role: dto.role ?? 'user',
      isActive: true
    });

    await this.syncService.syncUser(user);
    await this.redisService.invalidateAnalyticsCache();

    return user;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() });
  }

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  }

  async findById(id: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user id');
    }

    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async list(query: PaginationQueryDto): Promise<{ items: UserDocument[]; total: number }> {
    const filter: FilterQuery<UserDocument> = {};
    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize),
      this.userModel.countDocuments(filter)
    ]);

    return { items, total };
  }

  async update(id: string, dto: UpdateUserDto, requester: AuthenticatedUser): Promise<UserDocument> {
    if (requester.sub !== id && requester.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    const user = await this.findById(id);
    if (dto.name) user.name = dto.name;
    if (dto.phone) user.phone = dto.phone;
    if (dto.role && requester.role === 'admin') user.role = dto.role;
    if (dto.isActive !== undefined && requester.role === 'admin') user.isActive = dto.isActive;

    await user.save();
    await this.syncService.syncUser(user);
    await this.syncService.syncUserRelations(user);
    await this.redisService.invalidateAnalyticsCache();

    return user;
  }

  async deactivate(id: string, requester: AuthenticatedUser): Promise<UserDocument> {
    if (requester.role !== 'admin') {
      throw new ForbiddenException('Access denied');
    }

    const user = await this.findById(id);
    user.isActive = false;
    await user.save();
    await this.syncService.syncUser(user);
    await this.syncService.syncUserRelations(user);
    await this.redisService.invalidateAnalyticsCache();

    return user;
  }
}
