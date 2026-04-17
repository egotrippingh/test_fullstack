import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Public()
  @ApiOkResponse({
    description: 'Проверка доступности backend',
    schema: {
      example: {
        status: 'ok',
        app: 'promocode-manager-backend',
        environment: 'development',
        timestamp: '2026-04-11T11:00:00.000Z'
      }
    }
  })
  getHealth(): {
    status: 'ok';
    app: string;
    environment: string;
    timestamp: string;
  } {
    return {
      status: 'ok',
      app: 'promocode-manager-backend',
      environment: this.configService.get<string>('app.nodeEnv', 'development'),
      timestamp: new Date().toISOString()
    };
  }
}
