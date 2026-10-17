import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { verifyMetaSignature } from '@rto/vault';
import { createHash } from 'crypto';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/current-user';
import { Public, SkipCsrf } from '../common/guards';
import { ZodValidationPipe } from '../common/zod.pipe';
import { whatsappSaveSchema, whatsappSendSchema, whatsappTestSchema } from '../common/validation';
import type { UserDocument } from '../database/user.schema';
import { InboxService } from '../inbox/inbox.service';
import { WhatsAppService } from './whatsapp.service';

type RawRequest = Request & { rawBody?: Buffer };

function phoneNumberId(body: Record<string, unknown>) {
  const entries = Array.isArray(body.entry) ? (body.entry as Array<Record<string, unknown>>) : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? (entry.changes as Array<Record<string, unknown>>) : [];
    for (const change of changes) {
      const value = (change.value || {}) as { metadata?: { phone_number_id?: string } };
      if (value.metadata?.phone_number_id) return String(value.metadata.phone_number_id);
    }
  }
  return '';
}

@Controller()
export class WhatsAppController {
  constructor(
    private readonly whatsapp: WhatsAppService,
    @Inject(forwardRef(() => InboxService)) private readonly inbox: InboxService,
  ) {}

  @Get('whatsapp')
  status(@CurrentUser() user: UserDocument) {
    return this.whatsapp.status(user);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('whatsapp')
  save(
    @CurrentUser() user: UserDocument,
    @Body(new ZodValidationPipe(whatsappSaveSchema))
    body: { accessToken?: string; phoneNumberId: string; wabaId: string; appSecret?: string },
  ) {
    return this.whatsapp.save(user, body);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('whatsapp/test')
  test(
    @CurrentUser() user: UserDocument,
    @Body(new ZodValidationPipe(whatsappTestSchema)) body: { to: string },
  ) {
    return this.whatsapp.sendTest(user, body.to);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('whatsapp/template')
  template(@CurrentUser() user: UserDocument) {
    return this.whatsapp.submitTemplate(user);
  }

  @Get('whatsapp/template')
  templateStatus(@CurrentUser() user: UserDocument) {
    return this.whatsapp.refreshTemplate(user);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('whatsapp/send')
  send(
    @CurrentUser() user: UserDocument,
    @Body(new ZodValidationPipe(whatsappSendSchema)) body: { ids: string[] },
  ) {
    return this.whatsapp.sendOrders(user, body.ids);
  }

  @Public()
  @SkipThrottle()
  @Get('whatsapp/webhook')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const expected = this.whatsapp.verifyToken();
    if (mode !== 'subscribe' || !expected || token !== expected || !challenge) {
      throw new ForbiddenException('WhatsApp verify token did not match');
    }
    res.status(200).type('text/plain').send(challenge);
  }

  @Public()
  @SkipCsrf()
  @SkipThrottle()
  @HttpCode(200)
  @Post('whatsapp/webhook')
  async inbound(
    @Req() req: RawRequest,
    @Headers('x-hub-signature-256') signature: string,
  ) {
    const raw = req.rawBody;
    if (!raw) throw new UnauthorizedException('WhatsApp signature check failed');
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('WhatsApp payload was not JSON');
    }
    const phoneId = phoneNumberId(body);
    const user = phoneId ? await this.whatsapp.findByPhone(phoneId) : null;
    const secret = user ? this.whatsapp.secretForPhone(user) : '';
    if (!secret || !verifyMetaSignature(raw, signature, secret)) {
      throw new UnauthorizedException('WhatsApp signature check failed');
    }
    const webhookId = createHash('sha256').update(raw).digest('hex');
    const saved = await this.inbox.accept({
      webhookId,
      provider: 'whatsapp',
      topic: 'messages',
      shop: phoneId,
      payload: raw.toString('utf8'),
    });
    void this.inbox.drain(10);
    return { ok: true, duplicate: saved.duplicate };
  }
}
