import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @ApiOkResponse({ description: 'Регистрация пользователя' })
  async register(@Body() dto: RegisterDto): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @ApiOkResponse({ description: 'Логин пользователя' })
  async login(@Body() dto: LoginDto): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @Public()
  async refresh(@Body() dto: RefreshDto): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @Public()
  @ApiBearerAuth()
  async logout(@Body() dto: RefreshDto): Promise<{ ok: true }> {
    await this.authService.logout(dto.refreshToken);
    return { ok: true };
  }
}
