import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../common/current-user';
import { Public } from '../common/guards';
import { ZodValidationPipe } from '../common/zod.pipe';
import {
  importSchema,
  listQuerySchema,
  manualOrderSchema,
  addressUpdateSchema,
  callSchema,
  outcomeSchema,
  previewSchema,
  type ImportInput,
  type ManualOrderInput,
} from '../common/validation';
import type { UserDocument } from '../database/user.schema';
import { OrdersService } from './orders.service';

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('orders/template')
  template(@Res() res: Response) {
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', 'attachment; filename="rto-shield-template.csv"');
    res.send(this.orders.template());
  }

  @Post('orders/preview')
  preview(@Body(new ZodValidationPipe(previewSchema)) body: { csv: string }) {
    return this.orders.preview(body.csv);
  }

  @Post('orders/import')
  importCsv(@CurrentUser() user: UserDocument, @Body(new ZodValidationPipe(importSchema)) body: ImportInput) {
    return this.orders.importCsv(user, body);
  }

  @Post('orders/sample')
  sample(@CurrentUser() user: UserDocument) {
    return this.orders.loadSample(user);
  }

  @Post('orders/manual')
  manual(@CurrentUser() user: UserDocument, @Body(new ZodValidationPipe(manualOrderSchema)) body: ManualOrderInput) {
    return this.orders.createManual(user, body);
  }

  @Post('orders/score')
  async score(@CurrentUser() user: UserDocument) {
    const result = await this.orders.score(user, { fast: true });
    this.orders.startUpgrade(user, { full: true });
    return { ...result, upgrading: true };
  }

  @Get('orders/score-status')
  async scoreStatus(@CurrentUser() user: UserDocument) {
    const model = await this.orders.latestModel(user);
    return { upgrading: this.orders.isUpgrading(String(user._id)), model };
  }

  @Get('orders')
  list(
    @CurrentUser() user: UserDocument,
    @Query(new ZodValidationPipe(listQuerySchema))
    query: {
      stage?: 'history' | 'pending' | 'closed';
      outcome?: 'delivered' | 'rto' | 'cancelled' | 'confirmed' | 'converted' | 'no_response';
      q?: string;
      limit: number;
      offset: number;
    },
  ) {
    return this.orders.list(user, query);
  }

  @Get('queue')
  queue(@CurrentUser() user: UserDocument, @Query('scope') scope?: string) {
    return this.orders.queue(user, scope === 'open' ? 'open' : 'action');
  }

  @Get('activity')
  activity(@CurrentUser() user: UserDocument) {
    return this.orders.activity(user);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('pay/:token')
  pay(@Param('token') token: string) {
    return this.orders.payTarget(token);
  }

  @Get('orders/:id')
  getOne(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.orders.getOne(user, id);
  }

  @Patch('orders/:id/outcome')
  outcome(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(outcomeSchema)) body: { outcome: 'confirmed' | 'cancelled' | 'no_response' },
  ) {
    return this.orders.markOutcome(user, id, body.outcome);
  }

  @Post('orders/:id/prepaid')
  prepaid(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.orders.offerPrepaid(user, id);
  }

  @Post('orders/:id/address')
  address(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addressUpdateSchema))
    body: { address?: string; landmark?: string; source: 'reply' | 'call' | 'seller'; useReply?: boolean },
  ) {
    return this.orders.fixAddress(user, id, body);
  }

  @Post('orders/:id/call')
  call(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(callSchema)) body: { browser?: boolean },
  ) {
    return this.orders.placeCall(user, id, Boolean(body.browser));
  }

  @Post('orders/:id/extra-call')
  extraCall(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.orders.tryOneMoreCall(user, id);
  }

  @Post('orders/:id/escalate')
  escalate(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.orders.escalate(user, id);
  }
}
