import { forwardRef, Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CryptoService } from '../common/crypto.service';
import { DemoService } from '../demo/demo.service';
import { InboxEvent, type InboxDocument } from '../database/inbox.schema';
import { ShopifyService } from '../shopify/shopify.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class InboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InboxService.name);
  private timer: NodeJS.Timeout | null = null;
  private draining = false;

  constructor(
    private readonly crypto: CryptoService,
    @Inject(forwardRef(() => ShopifyService)) private readonly shopify: ShopifyService,
    @Inject(forwardRef(() => WhatsAppService)) private readonly whatsapp: WhatsAppService,
    @InjectModel(InboxEvent.name) private readonly inbox: Model<InboxEvent>,
    private readonly demo: DemoService,
  ) {}

  onModuleInit() {
    setImmediate(() => {
      void this.drain(25);
    });
    this.timer = setInterval(() => {
      void this.drain(25);
    }, 30_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async accept(input: {
    webhookId: string;
    provider: 'shopify' | 'whatsapp';
    topic: string;
    shop: string;
    payload: string;
  }) {
    try {
      await this.inbox.create({
        webhookId: input.webhookId,
        provider: input.provider,
        topic: input.topic.slice(0, 80),
        shop: input.shop.slice(0, 200),
        payloadEnc: this.crypto.encrypt(input.payload),
        status: 'pending',
        attempts: 0,
        receivedAt: new Date(),
      });
      return { duplicate: false };
    } catch (error) {
      if (error && typeof error === 'object' && (error as { code?: number }).code === 11000) {
        return { duplicate: true };
      }
      throw error;
    }
  }

  async drain(limit = 25) {
    if (this.draining) return { processed: 0, skipped: true };
    this.draining = true;
    let processed = 0;
    try {
      await this.inbox.updateMany(
        { status: 'processing', receivedAt: { $lt: new Date(Date.now() - 120_000) } },
        { $set: { status: 'pending' } },
      );
      for (let index = 0; index < limit; index += 1) {
        const event = await this.inbox.findOneAndUpdate(
          { status: 'pending' },
          { $set: { status: 'processing' }, $inc: { attempts: 1 } },
          { sort: { receivedAt: 1 }, new: true },
        );
        if (!event) break;
        try {
          await this.process(event);
          event.status = 'done';
          event.payloadEnc = '';
          event.processedAt = new Date();
          event.error = '';
          await event.save();
          processed += 1;
        } catch (error) {
          const name = error instanceof Error ? error.name : 'error';
          this.logger.warn(`Inbox event missed: ${name}`);
          event.status = event.attempts >= 5 ? 'failed' : 'pending';
          event.error = name.slice(0, 80);
          await event.save();
        }
      }
      try {
        await this.demo.maybeReset();
      } catch (error) {
        this.logger.warn(`Demo reset missed: ${error instanceof Error ? error.name : 'error'}`);
      }
    } finally {
      this.draining = false;
    }
    return { processed, skipped: false };
  }

  private async process(event: InboxDocument) {
    const raw = event.payloadEnc ? this.crypto.decrypt(event.payloadEnc) : '{}';
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (event.provider === 'shopify') {
      await this.shopify.applyTopic(event.shop, event.topic, body);
      return;
    }
    await this.whatsapp.applyInbound(event.shop, body);
  }
}
