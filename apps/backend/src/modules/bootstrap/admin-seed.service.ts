import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';

import { RedisService } from '../redis/redis.service';
import { SyncService } from '../sync/sync.service';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class AdminSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
    private readonly syncService: SyncService,
    private readonly redisService: RedisService
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const enabled = this.configService.get<boolean>('seed.adminEnabled', true);
    if (enabled) {
      await this.ensureAdmin();
    }

    await this.syncService.rebuildReadModel();
    await this.redisService.invalidateAnalyticsCache();
  }

  private async ensureAdmin(): Promise<void> {
    const existingAdmin = await this.userModel.findOne({ role: 'admin' });
    if (existingAdmin) {
      return;
    }

    const adminEmail = this.configService.get<string>('seed.adminEmail', 'admin@example.com');
    const adminName = this.configService.get<string>('seed.adminName', 'Admin');
    const adminPhone = this.configService.get<string>('seed.adminPhone', '+10000000000');

    let admin = await this.userModel.findOne({ email: adminEmail.toLowerCase() }).select('+passwordHash');
    if (admin) {
      admin.role = 'admin';
      admin.isActive = true;
      await admin.save();
      this.logger.log(`Promoted seeded admin account ${admin.email}`);
      return;
    }

    const adminPassword = this.configService.get<string>('seed.adminPassword', 'admin12345');
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    admin = await this.userModel.create({
      email: adminEmail.toLowerCase(),
      passwordHash,
      name: adminName,
      phone: adminPhone,
      role: 'admin',
      isActive: true
    });

    this.logger.log(`Created seeded admin account ${admin.email}`);
  }
}
