import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { CurrentUser } from '../common/current-user';
import { Public, SkipCsrf } from '../common/guards';
import { ZodValidationPipe } from '../common/zod.pipe';
import { elevenKeySchema } from '../common/validation';
import type { UserDocument } from '../database/user.schema';
import { OrdersService } from '../orders/orders.service';
import { ElevenLabsService } from './elevenlabs.service';

type RawRequest = Request & { rawBody?: Buffer };

function sameSecret(header: string, expected: string) {
  if (!expected || !header || header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

@Controller()
export class ElevenLabsController {
  constructor(
    private readonly eleven: ElevenLabsService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => OrdersService)) private readonly orders: OrdersService,
  ) {}

  @Get('elevenlabs')
  status(@CurrentUser() user: UserDocument) {
    return this.eleven.status(user);
  }

  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('elevenlabs')
  save(@CurrentUser() user: UserDocument, @Body(new ZodValidationPipe(elevenKeySchema)) body: { apiKey?: string }) {
    return this.eleven.save(user, body.apiKey);
  }

  @Delete('elevenlabs')
  clear(@CurrentUser() user: UserDocument) {
    return this.eleven.clear(user);
  }

  @Public()
  @SkipCsrf()
  @SkipThrottle()
  @HttpCode(200)
  @Post('elevenlabs/webhook')
  async webhook(@Req() req: RawRequest, @Headers('elevenlabs-signature') signature?: string) {
    const parsed = this.eleven.acceptWebhook(req.rawBody || Buffer.alloc(0), signature || '');
    await this.orders.applyVoiceOutcome(parsed);
    return { ok: true };
  }

  /** Uses the server key. The caller never sends ELEVENLABS_API_KEY. */
  @Public()
  @SkipCsrf()
  @SkipThrottle()
  @HttpCode(200)
  @Post('elevenlabs/agent')
  async agent(@Headers('x-inbox-secret') secret?: string) {
    const expected = this.config.get<string>('INBOX_DRAIN_SECRET')?.trim() || '';
    if (!sameSecret(secret || '', expected)) throw new UnauthorizedException('Agent sync refused');
    const result = await this.eleven.syncFromEnv(true);
    return {
      agentId: result.agentId,
      created: result.created,
      webhookId: result.webhookId,
      webhookSecret: result.webhookSecret,
    };
  }
}
