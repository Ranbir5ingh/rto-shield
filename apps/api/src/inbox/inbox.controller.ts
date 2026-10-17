import { Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { Public, SkipCsrf } from '../common/guards';
import { InboxService } from './inbox.service';

function sameSecret(header: string, expected: string) {
  if (!expected || !header || header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

@Controller()
export class InboxController {
  constructor(
    private readonly inbox: InboxService,
    private readonly config: ConfigService,
  ) {}

  /** Vercel pings this after it stores a webhook. The API may be waking up. */
  @Public()
  @SkipCsrf()
  @SkipThrottle()
  @HttpCode(200)
  @Post('inbox/drain')
  drain(@Headers('x-inbox-secret') secret: string) {
    const expected = this.config.get<string>('INBOX_DRAIN_SECRET')?.trim() || '';
    if (!sameSecret(secret || '', expected)) throw new UnauthorizedException('Inbox drain refused');
    return this.inbox.drain(25);
  }
}
