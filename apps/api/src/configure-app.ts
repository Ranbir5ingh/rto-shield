import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters';

export function webOrigins(raw = process.env.WEB_ORIGIN): string[] {
  const value = raw?.trim() ? raw : 'http://localhost:3000';
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.use(
    helmet({
      // Health checks are read from www.rtoshield.tech. Helmet's default
      // same-origin policy would hide that JSON from the browser.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());
  app.use(json({ limit: process.env.JSON_LIMIT || '6mb' }));
  app.enableCors({ origin: webOrigins(), credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter());
  const server = app.getHttpAdapter().getInstance() as { set?: (key: string, value: number) => void };
  server.set?.('trust proxy', 1);
}
