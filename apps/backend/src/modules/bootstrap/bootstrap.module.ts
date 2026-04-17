import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { RedisModule } from '../redis/redis.module';
import { SyncModule } from '../sync/sync.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AdminSeedService } from './admin-seed.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    SyncModule,
    RedisModule
  ],
  providers: [AdminSeedService]
})
export class BootstrapModule {}
