import { Body, Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { Public, SkipCsrf } from '../common/guards';
import { ZodValidationPipe } from '../common/zod.pipe';
import { purgeUserSchema } from '../common/validation';
import { AdminService } from './admin.service';

function sameSecret(header: string, expected: string) {
  if (!expected || !header || header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

@Controller()
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly config: ConfigService,
  ) {}

  /** Hard-deletes one shop. The caller sends the inbox secret, never a session. */
  @Public()
  @SkipCsrf()
  @SkipThrottle()
  @HttpCode(200)
  @Post('admin/users/purge')
  purge(
    @Headers('x-inbox-secret') secret: string | undefined,
    @Body(new ZodValidationPipe(purgeUserSchema)) body: { email: string },
  ) {
    const expected = this.config.get<string>('INBOX_DRAIN_SECRET')?.trim() || '';
    if (!sameSecret(secret || '', expected)) throw new UnauthorizedException('Purge refused');
    return this.admin.purge(body.email);
  }
}
