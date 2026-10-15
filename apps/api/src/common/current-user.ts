import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthedRequest } from './guards';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});
