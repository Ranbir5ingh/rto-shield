import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/guards';
import { MlService } from '../ml/ml.service';

@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
  constructor(private readonly ml: MlService) {}

  @Get()
  health() {
    return { ok: true, service: 'rto-shield-api' };
  }

  @Get('deep')
  async deep() {
    const ml = await this.ml.health(5_000);
    return {
      ok: true,
      service: 'rto-shield-api',
      ml: { ok: Boolean(ml?.ok) },
    };
  }
}
