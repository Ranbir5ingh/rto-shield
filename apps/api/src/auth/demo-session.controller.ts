import { Controller, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../common/guards';
import { clientIp, demoSessionMs } from '../demo/demo.policy';
import { AuthService } from './auth.service';

@Controller()
export class DemoSessionController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('demo/session')
  async open(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.openLiveDemo(clientIp(req.ip, req.headers['x-forwarded-for'], req.headers['x-rto-client-ip']));
    const ttl = demoSessionMs();
    this.auth.writeSession(res, session, { accessMs: ttl, refreshMs: ttl });
    return { user: session.user, csrfToken: session.csrf, demo: true };
  }
}
