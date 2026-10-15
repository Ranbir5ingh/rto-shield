import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../common/cookies';
import { CurrentUser } from '../common/current-user';
import { Public } from '../common/guards';
import { ZodValidationPipe } from '../common/zod.pipe';
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from '../common/validation';
import type { UserDocument } from '../database/user.schema';
import { AuthService } from './auth.service';

const authLimit = Number(process.env.AUTH_RATE_LIMIT_MAX || 30);

@Controller('auth')
@Throttle({ default: { limit: authLimit, ttl: 900000 } })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get('csrf')
  csrf(@Res({ passthrough: true }) res: Response) {
    const csrfToken = this.auth.csrfToken();
    this.auth.setCsrf(res, csrfToken);
    return { csrfToken };
  }

  @Public()
  @Post('signup')
  async signup(
    @Body(new ZodValidationPipe(signupSchema)) body: SignupInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.signup(body);
    this.auth.writeSession(res, session);
    return { user: session.user, csrfToken: session.csrf };
  }

  @Public()
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.login(body);
    this.auth.writeSession(res, session);
    return { user: session.user, csrfToken: session.csrf };
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.refresh(req.cookies?.[REFRESH_COOKIE] as string | undefined);
    this.auth.writeSession(res, session);
    return { user: session.user, csrfToken: session.csrf };
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies?.[ACCESS_COOKIE] || req.cookies?.[REFRESH_COOKIE]) as string | undefined;
    await this.auth.logout(token);
    this.auth.clearSession(res);
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: UserDocument) {
    return { user: this.auth.toPublic(user) };
  }
}
