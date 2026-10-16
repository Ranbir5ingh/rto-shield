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
   * Backup wake for the ML service once this API is already up.
   * The browser also calls ML directly. This hold is long on purpose:
   * a 3 second abort never kept Render's free instance spinning.
   * Always 200: a cold 502/503 or a timeout becomes `{ ok: false }`.
   */
  @Get('ml')
  async mlPassThrough() {
    const ml = await this.ml.health(45_000);
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
