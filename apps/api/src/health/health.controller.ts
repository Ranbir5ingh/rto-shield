import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/guards';

@Controller('health')
export class HealthController {
  @Public()
  @SkipThrottle()
  @Get()
  health() {
    return { ok: true, service: 'rto-shield-api' };
  }
}
