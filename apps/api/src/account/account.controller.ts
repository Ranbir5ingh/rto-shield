import { Body, Controller, Delete, Get, Patch, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/current-user';
import { ZodValidationPipe } from '../common/zod.pipe';
import {
  deleteAccountSchema,
  deleteDataSchema,
  settingsSchema,
  type SettingsInput,
} from '../common/validation';
import type { UserDocument } from '../database/user.schema';
import { AccountService } from './account.service';

@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Patch('settings')
  settings(@CurrentUser() user: UserDocument, @Body(new ZodValidationPipe(settingsSchema)) body: SettingsInput) {
    return this.account.updateSettings(user, body);
  }

  @Get('export')
  async exportCsv(@CurrentUser() user: UserDocument, @Res() res: Response) {
    const csv = await this.account.exportCsv(user);
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', 'attachment; filename="rto-shield-export.csv"');
    res.send(csv);
  }

  @Delete('data')
  deleteData(
    @CurrentUser() user: UserDocument,
    @Body(new ZodValidationPipe(deleteDataSchema)) _body: { confirm: 'DELETE' },
  ) {
    return this.account.deleteData(user);
  }

  @Delete()
  deleteAccount(
    @CurrentUser() user: UserDocument,
    @Body(new ZodValidationPipe(deleteAccountSchema)) body: { confirm: 'DELETE'; password: string },
  ) {
    return this.account.deleteAccount(user, body.password);
  }
}
