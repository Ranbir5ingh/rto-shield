import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/current-user';
import { Public, SkipCsrf } from '../common/guards';
import { ZodValidationPipe } from '../common/zod.pipe';
import { elevenKeySchema } from '../common/validation';
import type { UserDocument } from '../database/user.schema';
import { OrdersService } from '../orders/orders.service';
import { NarrationService } from '../tours/narration.service';
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
    private readonly narration: NarrationService,
  ) {}

  /** Cached tour voice. The API key stays on the server. Unknown steps and a missing key are silent. */
  @Get('tours/narration/:stepId')
  async narrationAudio(
    @Param('stepId') stepId: string,
    @Query('lang') lang: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const language = lang === 'hindi' || lang === 'hinglish' ? lang : 'english';
    const tag = this.narration.etag(stepId, language);
    const matches = tag && req.headers['if-none-match'] === tag;
    if (matches && tag) {
      res.status(304);
      res.setHeader('ETag', tag);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.end();
      return;
    }
    const audio = await this.narration.audio(stepId, language);
    if (!audio) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(204).end();
      return;
    }
    res.status(200);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (tag) res.setHeader('ETag', tag);
    res.setHeader('Content-Length', String(audio.length));
    res.end(audio);
  }

  /** Fill GridFS and the narration cache. Header x-inbox-secret must match INBOX_DRAIN_SECRET. */
  @Public()
  @SkipCsrf()
  @SkipThrottle()
  @HttpCode(200)
  @Post('tours/narration/warm')
  async warmNarration(@Headers('x-inbox-secret') secret?: string) {
    const expected = this.config.get<string>('INBOX_DRAIN_SECRET')?.trim() || '';
    if (!sameSecret(secret || '', expected)) throw new UnauthorizedException('Narration warm refused');
    return this.narration.warm();
  }

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
