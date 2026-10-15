import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/guards';
import { MlService } from '../ml/ml.service';

@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
  constructor(private readonly ml: MlService) {}

  /** Cheap boot check. Must not query MongoDB, so it can answer as soon as the process listens. */
  @Get()
  health() {
    return { ok: true, service: 'rto-shield-api' };
  }

  /**
   * Same-origin pass-through for the ML service. Always 200: a cold Render 502/503 or a timeout
   * becomes `{ ok: false }` so the wake-up loader can keep polling.
   */
  @Get('ml')
  async mlPassThrough() {
    const ml = await this.ml.health(3_000);
    return { ok: Boolean(ml?.ok) };
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
