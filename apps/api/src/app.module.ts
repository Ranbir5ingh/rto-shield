import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SentryModule } from '@sentry/nestjs/setup';
import { AccountModule } from './account/account.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CryptoModule } from './common/crypto.module';
import { CsrfGuard, JwtAuthGuard } from './common/guards';
import { DemoModule } from './demo/demo.module';
import { DemoWriteGuard } from './demo/demo.guard';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { GeminiModule } from './gemini/gemini.module';
import { HealthModule } from './health/health.module';
import { InboxModule } from './inbox/inbox.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { OrdersModule } from './orders/orders.module';
import { ShopifyModule } from './shopify/shopify.module';
import { VoiceModule } from './voice/voice.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';

const sentryImports = process.env.SENTRY_DSN ? [SentryModule.forRoot()] : [];

@Module({
  imports: [
    ...sentryImports,
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        // Listen without waiting for Atlas. GET /api/health never touches this connection.
        lazyConnection: true,
      }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60_000,
          limit: process.env.NODE_ENV === 'test' ? 10_000 : Number(process.env.RATE_LIMIT_MAX || 300),
        },
      ],
    }),
    CryptoModule,
    DatabaseModule,
    AuthModule,
    HealthModule,
    OrdersModule,
    DashboardModule,
    AccountModule,
    AdminModule,
    IntegrationsModule,
    ShopifyModule,
    WhatsAppModule,
    VoiceModule,
    InboxModule,
    GeminiModule,
    DemoModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: DemoWriteGuard },
  ],
})
export class AppModule {}
