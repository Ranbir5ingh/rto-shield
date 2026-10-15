import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters';

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.use(json({ limit: process.env.JSON_LIMIT || '6mb' }));
  const origins = (process.env.WEB_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter());
  const server = app.getHttpAdapter().getInstance() as { set?: (key: string, value: number) => void };
  server.set?.('trust proxy', 1);
}
