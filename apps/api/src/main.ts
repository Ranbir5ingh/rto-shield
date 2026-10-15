import './instrument';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function prepareEnv() {
  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production');
    }
    process.env.JWT_SECRET = 'dev-only-jwt-secret-change-me';
    console.warn('JWT_SECRET unset — using a development secret.');
  }
  if (!process.env.ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY is required in production');
  }
  if (!process.env.MONGODB_URI) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MONGODB_URI is required in production');
    }
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const memory = await MongoMemoryServer.create();
    process.env.MONGODB_URI = memory.getUri();
    process.env.MONGODB_MODE = 'memory';
    console.warn('MONGODB_URI unset — using in-memory MongoDB. Data will not persist.');
  } else if (!process.env.MONGODB_MODE) {
    process.env.MONGODB_MODE = 'configured';
  }
}

async function bootstrap() {
  await prepareEnv();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app);
  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on ${port}`, 'Bootstrap');
}

void bootstrap();
