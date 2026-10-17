import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VaultService } from '../common/vault.service';
import { effectiveRole } from '../demo/demo.policy';
import { AuditEvent } from '../database/audit.schema';
import type { UserDocument } from '../database/user.schema';

@Injectable()
export class GeminiService {
  constructor(
    private readonly vault: VaultService,
    @InjectModel(AuditEvent.name) private readonly audit: Model<AuditEvent>,
  ) {}

  status(user: UserDocument) {
    const visitor = effectiveRole(user) === 'demo';
    return {
      configured: Boolean(user.gemini?.keyEnvelope && user.gemini.validatedAt),
      last4: visitor ? '' : user.gemini?.last4 || '',
      validatedAt: user.gemini?.validatedAt || null,
      demoFallback: Boolean(user.isDemo),
    };
  }

  async save(user: UserDocument, apiKey?: string) {
    if (user.role === 'staff') throw new BadRequestException('Only the shop owner can change connections');
    const key = apiKey?.trim() || '';
    if (!key) return this.status(user);
    let response: Response;
    try {
      response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
        headers: { 'x-goog-api-key': key },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadRequestException('Gemini did not accept that key');
    }
    if (!response.ok) throw new BadRequestException('Gemini did not accept that key');
    user.gemini = {
      keyEnvelope: this.vault.seal(key),
      last4: this.vault.mask(key),
      validatedAt: new Date().toISOString(),
    };
    await user.save();
    await this.audit.create({ sellerId: user._id, action: 'gemini.save', meta: { last4: user.gemini.last4 } });
    return this.status(user);
  }

  async clear(user: UserDocument) {
    if (user.role === 'staff') throw new BadRequestException('Only the shop owner can change connections');
    user.gemini = null;
    await user.save();
    await this.audit.create({ sellerId: user._id, action: 'gemini.clear', meta: {} });
    return this.status(user);
  }
}
