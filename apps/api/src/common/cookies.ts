import type { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';

export const ACCESS_COOKIE = 'rto_access';
export const REFRESH_COOKIE = 'rto_refresh';
export const CSRF_COOKIE = 'rto_csrf';

export function cookieOptions(config: ConfigService, httpOnly: boolean, maxAge: number): CookieOptions {
  const sameSite = (config.get<string>('COOKIE_SAMESITE') || 'lax') as 'lax' | 'strict' | 'none';
  const secureEnv = config.get<string>('COOKIE_SECURE');
  const secure = secureEnv ? secureEnv === 'true' : process.env.NODE_ENV === 'production';
  return { httpOnly, sameSite, secure, path: '/', maxAge };
}

export function writeSessionCookies(
  res: Response,
  config: ConfigService,
  tokens: { access: string; refresh: string; csrf: string },
  ttl?: { accessMs?: number; refreshMs?: number },
) {
  const accessMs = ttl?.accessMs ?? 15 * 60 * 1000;
  const refreshMs = ttl?.refreshMs ?? 7 * 24 * 60 * 60 * 1000;
  res.cookie(ACCESS_COOKIE, tokens.access, cookieOptions(config, true, accessMs));
  res.cookie(REFRESH_COOKIE, tokens.refresh, cookieOptions(config, true, refreshMs));
  res.cookie(CSRF_COOKIE, tokens.csrf, cookieOptions(config, false, refreshMs));
}

export function clearSessionCookies(res: Response, config: ConfigService) {
  const base = cookieOptions(config, true, 0);
  res.clearCookie(ACCESS_COOKIE, { ...base, maxAge: undefined });
  res.clearCookie(REFRESH_COOKIE, { ...base, maxAge: undefined });
  res.clearCookie(CSRF_COOKIE, { ...cookieOptions(config, false, 0), maxAge: undefined });
}
