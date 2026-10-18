import { Body, Controller, Get, Headers, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { CurrentUser } from '../common/current-user';
import { Public, SkipCsrf } from '../common/guards';
import { ZodValidationPipe } from '../common/zod.pipe';
import type { UserDocument } from '../database/user.schema';
import { clientIp, isDemoSession } from './demo.policy';
import { tourCompleteSchema } from './demo.validation';
import { DemoService } from './demo.service';
import type { Request } from 'express';

function sameSecret(header: string, expected: string) {
  if (!expected || !header || header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

@Controller()
export class DemoController {
  constructor(
    private readonly demo: DemoService,
    private readonly config: ConfigService,
  ) {}

  @Get('demo/call-budget')
  callBudget(@CurrentUser() user: UserDocument, @Req() req: Request) {
    return this.demo.demoCallBudget(user, clientIp(req.ip, req.headers['x-forwarded-for'], req.headers['x-rto-client-ip']));
  }

  @Post('tours/complete')
  complete(
    @CurrentUser() user: UserDocument,
    @Body(new ZodValidationPipe(tourCompleteSchema)) body: { tour: 'seller' | 'demo' },
  ) {
    return this.demo.completeTour(user, body.tour);
  }

  /** The signed-in demo shop can rewind its own baseline. Visitors confirm this in the app. */
  @Post('demo/rewind')
  rewind(@CurrentUser() user: UserDocument) {
    if (!isDemoSession(user)) {
      throw new UnauthorizedException('Only the demo shop can reset');
    }
    return this.demo.reset();
  }

  /** Render cron or the inbox drain can call this. It only rewinds demo decisions. */
  @Public()
  @SkipCsrf()
  @SkipThrottle()
  @HttpCode(200)
  @Post('demo/reset')
  reset(@Headers('x-inbox-secret') secret: string) {
    const expected = this.config.get<string>('INBOX_DRAIN_SECRET')?.trim() || '';
    if (!sameSecret(secret || '', expected)) throw new UnauthorizedException('Demo reset refused');
    return this.demo.reset();
  }
}
