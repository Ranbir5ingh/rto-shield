import { Body, Controller, Header, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/current-user';
import { ZodValidationPipe } from '../common/zod.pipe';
import { secretRevealSchema } from '../common/validation';
import type { UserDocument } from '../database/user.schema';
import { SecretsService, type SecretField } from './secrets.service';

@Controller('settings')
export class SecretsController {
  constructor(private readonly secrets: SecretsService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store, private')
  @Header('Pragma', 'no-cache')
  @HttpCode(200)
  @Post('secrets/reveal')
  reveal(
    @CurrentUser() user: UserDocument,
    @Body(new ZodValidationPipe(secretRevealSchema)) body: { field: SecretField; password: string },
  ) {
    return this.secrets.reveal(user, body.field, body.password);
  }
}
