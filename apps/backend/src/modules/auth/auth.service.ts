import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import type { StringValue } from 'ms';

import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

interface TokenPayload {
  sub: string;
  email: string;
  role: 'admin' | 'user';
  jti?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string; refreshToken: string }> {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create(
      {
        email: dto.email,
        password: dto.password,
        name: dto.name,
        phone: dto.phone
      },
      passwordHash
    );

    return this.generateTokens(user);
  }

  async login(dto: LoginDto): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = await this.verifyRefreshToken(refreshToken);
    if (!payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const exists = await this.redisService.hasRefreshToken(payload.sub, payload.jti);
    if (!exists) {
      throw new UnauthorizedException('Refresh token revoked');
    }

    await this.redisService.revokeRefreshToken(payload.sub, payload.jti);

    const user = await this.usersService.findById(payload.sub);
    return this.generateTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = await this.verifyRefreshToken(refreshToken);
    if (payload.jti) {
      await this.redisService.revokeRefreshToken(payload.sub, payload.jti);
    }
  }

  private async generateTokens(user: { _id: unknown; email: string; role: 'admin' | 'user' }): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const accessPayload: TokenPayload = {
      sub: String(user._id),
      email: user.email,
      role: user.role
    };

    const refreshPayload: TokenPayload = {
      ...accessPayload,
      jti: randomUUID()
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.configService.get<string>('jwt.accessSecret', 'dev-access-secret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn', '15m') as StringValue
    });

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.configService.get<string>('jwt.refreshSecret', 'dev-refresh-secret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn', '7d') as StringValue
    });

    const ttlSeconds = this.parseDurationToSeconds(
      this.configService.get<string>('jwt.refreshExpiresIn', '7d')
    );

    await this.redisService.storeRefreshToken(refreshPayload.sub, refreshPayload.jti!, ttlSeconds);

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(token: string): Promise<TokenPayload> {
    try {
      return await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.configService.get<string>('jwt.refreshSecret')
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private parseDurationToSeconds(value: string): number {
    const match = /^(\d+)(s|m|h|d)$/.exec(value);
    if (!match) {
      throw new BadRequestException('Invalid duration format');
    }

    const amount = Number(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return amount;
      case 'm':
        return amount * 60;
      case 'h':
        return amount * 3600;
      case 'd':
        return amount * 86400;
      default:
        return amount;
    }
  }
}
