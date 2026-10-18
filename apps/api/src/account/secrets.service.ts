import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { VaultService } from '../common/vault.service';
import { effectiveRole } from '../demo/demo.policy';
import { AuditEvent } from '../database/audit.schema';
import type { UserDocument } from '../database/user.schema';

export type SecretField = 'whatsappToken' | 'whatsappAppSecret';

@Injectable()
export class SecretsService {
  constructor(
    private readonly vault: VaultService,
    @InjectModel(AuditEvent.name) private readonly audit: Model<AuditEvent>,
  ) {}

  async reveal(user: UserDocument, field: SecretField, password: string) {
    if (effectiveRole(user) === 'demo') {
      await this.audit.create({ sellerId: user._id, action: 'secret.reveal_denied', meta: { field, demo: true } });
      throw new ForbiddenException('Demo sessions cannot reveal secrets');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await this.audit.create({ sellerId: user._id, action: 'secret.reveal_denied', meta: { field } });
      throw new UnauthorizedException('Password did not match');
    }
    if (user.role === 'staff') throw new ForbiddenException('Only the shop owner can reveal secrets');
    const envelope = field === 'whatsappToken' ? user.whatsapp?.tokenEnvelope : user.whatsapp?.appSecretEnvelope;
    let value = '';
    try {
      value = this.vault.open(envelope);
    } catch {
      throw new BadRequestException('That secret could not be opened');
    }
    if (!value) throw new BadRequestException('That secret is not saved yet');
    await this.audit.create({ sellerId: user._id, action: 'secret.reveal', meta: { field } });
    return { value };
  }
}
