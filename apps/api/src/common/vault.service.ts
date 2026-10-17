import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { last4, open, seal, type Envelope } from '@rto/vault';

@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);
  private readonly master: string;
  readonly mode: 'configured' | 'development-fallback';

  constructor(config: ConfigService) {
    const raw = config.get<string>('KEY_ENCRYPTION_KEY')?.trim() || '';
    if (!raw) {
      this.mode = 'development-fallback';
      this.master = 'rto-shield-dev-kek-not-for-production';
      if (process.env.NODE_ENV === 'production') {
        this.logger.warn('KEY_ENCRYPTION_KEY is unset. Shopify and WhatsApp secrets cannot be stored until it is set.');
      }
    } else {
      this.mode = 'configured';
      this.master = raw;
    }
  }

  /** Production refuses to seal with the development key. */
  seal(plain: string): Envelope {
    if (this.mode !== 'configured' && process.env.NODE_ENV === 'production') {
      throw new Error('Set KEY_ENCRYPTION_KEY before storing a shop secret');
    }
    return seal(plain, this.master);
  }

  open(envelope: Envelope | null | undefined): string {
    if (!envelope) return '';
    return open(envelope, this.master);
  }

  mask(secret: string): string {
    return last4(secret);
  }
}
