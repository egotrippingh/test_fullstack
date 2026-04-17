import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  const usersService = {
    create: jest.fn(),
    findByEmailWithPassword: jest.fn(),
    findById: jest.fn()
  };
  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn()
  };
  const configService = {
    get: jest.fn((key: string, fallback?: string) => fallback ?? `${key}-value`)
  };
  const redisService = {
    storeRefreshToken: jest.fn(),
    hasRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers a user and returns tokens', async () => {
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hash' as never);

    usersService.create.mockResolvedValue({
      _id: 'user-id',
      email: 'user@mail.com',
      role: 'user'
    });

    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    const service = new AuthService(usersService as never, jwtService as never, configService as never, redisService as never);

    const result = await service.register({
      email: 'user@mail.com',
      password: 'password',
      name: 'User',
      phone: '123456'
    });

    expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    expect(usersService.create).toHaveBeenCalled();
    expect(redisService.storeRefreshToken).toHaveBeenCalled();
  });

  it('rejects login with invalid credentials', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue(null);
    const service = new AuthService(usersService as never, jwtService as never, configService as never, redisService as never);

    await expect(service.login({ email: 'x@y.com', password: 'bad' })).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('rejects refresh token when revoked', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-id',
      email: 'user@mail.com',
      role: 'user',
      jti: 'token-id'
    });
    redisService.hasRefreshToken.mockResolvedValue(false);

    const service = new AuthService(usersService as never, jwtService as never, configService as never, redisService as never);

    await expect(service.refresh('refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
