import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/current-user';
import { ZodValidationPipe } from '../common/zod.pipe';
import {
  importSchema,
  listQuerySchema,
  manualOrderSchema,
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
  score(@CurrentUser() user: UserDocument) {
    return this.orders.score(user);
  }

  @Get('orders')
  list(
    @CurrentUser() user: UserDocument,
    @Query(new ZodValidationPipe(listQuerySchema))
    query: { stage?: 'history' | 'pending' | 'closed'; limit: number; offset: number },
  ) {
    return this.orders.list(user, query.stage, query.limit, query.offset);
  }

  @Get('queue')
  queue(@CurrentUser() user: UserDocument) {
    return this.orders.queue(user);
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
}
