import {
  BadRequestException,
  Body,
  Controller,
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
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { verifyShopifyOauth, verifyShopifyWebhook } from '@rto/vault';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/current-user';
import { Public, SkipCsrf } from '../common/guards';
import { ZodValidationPipe } from '../common/zod.pipe';
import { shopifyInstallSchema, shopifySettingsSchema } from '../common/validation';
import type { ShopifyLink, UserDocument } from '../database/user.schema';
import { InboxService } from '../inbox/inbox.service';
import { ShopifyService } from './shopify.service';

type RawRequest = Request & { rawBody?: Buffer };

function queryStrings(query: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) out[key] = String(value[0] ?? '');
    else if (value !== undefined) out[key] = String(value);
  }
  return out;
}

@Controller()
export class ShopifyController {
  constructor(
    private readonly shopify: ShopifyService,
    @Inject(forwardRef(() => InboxService)) private readonly inbox: InboxService,
    private readonly config: ConfigService,
  ) {}

  @Get('shopify')
  status(@CurrentUser() user: UserDocument) {
    return this.shopify.status(user);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('shopify/install')
  install(
    @CurrentUser() user: UserDocument,
    @Body(new ZodValidationPipe(shopifyInstallSchema)) body: { shop: string },
  ) {
    return this.shopify.beginInstall(user, body.shop);
  }

  @Post('shopify/settings')
  settings(
    @CurrentUser() user: UserDocument,
    @Body(new ZodValidationPipe(shopifySettingsSchema))
    body: { rtoTag?: string; autoCancelOnBuyerCancel?: boolean; riskTags?: ShopifyLink['riskTags'] },
  ) {
    return this.shopify.updateSettings(user, body);
  }

  @Post('shopify/resync')
  resync(@CurrentUser() user: UserDocument) {
    return this.shopify.resync(user);
  }

  /**
   * Browser returns here after the merchant approves the app.
   * HMAC plus a single-use state is the authentication. Late retries are not
   * rejected on timestamp; the state expires after 15 minutes instead.
   */
  @Public()
  @SkipCsrf()
  @SkipThrottle()
  @Get('shopify/callback')
  async callback(@Query() query: Record<string, unknown>, @Res() res: Response) {
    const flat = queryStrings(query);
    const secret = this.config.get<string>('SHOPIFY_API_SECRET')?.trim() || '';
    if (!verifyShopifyOauth(flat, secret)) throw new UnauthorizedException('Shopify HMAC check failed');
    const app = this.shopify.appUrl();
    try {
      await this.shopify.completeInstall(flat);
      res.redirect(302, `${app}/app/start?shopify=connected`);
    } catch {
      res.redirect(302, `${app}/app/start?shopify=error`);
    }
  }

  @Public()
  @SkipCsrf()
  @SkipThrottle()
  @HttpCode(200)
  @Post('shopify/webhooks')
  async webhook(
    @Req() req: RawRequest,
    @Headers('x-shopify-hmac-sha256') hmac: string,
    @Headers('x-shopify-webhook-id') webhookId: string,
    @Headers('x-shopify-topic') topic: string,
    @Headers('x-shopify-shop-domain') shop: string,
  ) {
    const secret = this.config.get<string>('SHOPIFY_API_SECRET')?.trim() || '';
    const raw = req.rawBody;
    if (!raw || !verifyShopifyWebhook(raw, hmac, secret)) {
      throw new UnauthorizedException('Shopify HMAC check failed');
    }
    if (!webhookId || webhookId.length > 128) throw new BadRequestException('Missing webhook id');
    const saved = await this.inbox.accept({
      webhookId,
      provider: 'shopify',
      topic: topic || 'unknown',
      shop: shop || '',
      payload: raw.toString('utf8'),
    });
    void this.inbox.drain(10);
    return { ok: true, duplicate: saved.duplicate };
  }
}
