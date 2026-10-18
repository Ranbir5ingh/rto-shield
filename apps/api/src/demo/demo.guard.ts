import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Request } from 'express';
import { Model } from 'mongoose';
import { AuditEvent } from '../database/audit.schema';
import type { AuthedRequest } from '../common/guards';
import { demoAllows, isDemoSession } from './demo.policy';

@Injectable()
export class DemoWriteGuard implements CanActivate {
  constructor(@InjectModel(AuditEvent.name) private readonly audit: Model<AuditEvent>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest & Request>();
    if (!req.user || !isDemoSession(req.user)) return true;
    const path = req.originalUrl || req.url || '';
    if (demoAllows(req.method, path)) return true;
    await this.audit.create({
      sellerId: req.user._id,
      action: 'demo.blocked',
      meta: { method: req.method, path: path.split('?')[0].slice(0, 160) },
    });
    throw new ForbiddenException('Demo sessions can look and score, but not change the shop.');
  }
}
