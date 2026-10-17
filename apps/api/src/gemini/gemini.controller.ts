import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/current-user';
import { ZodValidationPipe } from '../common/zod.pipe';
import { geminiKeySchema } from '../common/validation';
import type { UserDocument } from '../database/user.schema';
import { GeminiService } from './gemini.service';

@Controller('gemini')
export class GeminiController {
  constructor(private readonly gemini: GeminiService) {}

  @Get()
  status(@CurrentUser() user: UserDocument) {
    return this.gemini.status(user);
  }

  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post()
  save(
    @CurrentUser() user: UserDocument,
    @Body(new ZodValidationPipe(geminiKeySchema)) body: { apiKey: string },
  ) {
    return this.gemini.save(user, body.apiKey);
  }

  @Delete()
  clear(@CurrentUser() user: UserDocument) {
    return this.gemini.clear(user);
  }
}
