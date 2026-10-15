import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

function deriveKey(raw: string): Buffer {
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length === 32 && !/^[0-9a-f]+$/i.test(raw)) return decoded;
  return scryptSync(raw, 'rto-shield', 32);
}

@Injectable()
export class CryptoService {
  private readonly key: Buffer;
  readonly mode: 'configured' | 'development-fallback';
  private readonly logger = new Logger(CryptoService.name);

  constructor(config: ConfigService) {
    const raw = config.get<string>('ENCRYPTION_KEY')?.trim() || '';
    if (!raw) {
      this.mode = 'development-fallback';
      this.key = scryptSync('rto-shield-dev-only-key', 'rto-shield', 32);
      if (process.env.NODE_ENV !== 'test') {
        this.logger.warn('ENCRYPTION_KEY is unset. Using a development key. Do not store real buyer data.');
      }
    } else {
      this.mode = 'configured';
      this.key = deriveKey(raw);
    }
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
  }

  decrypt(payload: string): string {
    const [version, ivPart, tagPart, dataPart] = payload.split('.');
    if (version !== 'v1' || !ivPart || !tagPart || !dataPart) {
      throw new Error('Could not read encrypted field');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
