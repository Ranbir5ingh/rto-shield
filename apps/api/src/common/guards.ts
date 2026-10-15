import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { Model } from 'mongoose';
import { ACCESS_COOKIE, CSRF_COOKIE } from './cookies';
import { User, type UserDocument } from '../database/user.schema';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export interface AccessPayload {
  sub: string;
  tv: number;
  typ: 'access' | 'refresh';
}

export type AuthedRequest = Request & { user: UserDocument };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = req.cookies?.[ACCESS_COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedException('Login required');
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(token);
      if (payload.typ !== 'access') throw new UnauthorizedException('Login required');
      const user = await this.users.findById(payload.sub);
      if (!user || user.tokenVersion !== payload.tv) throw new UnauthorizedException('Login required');
      req.user = user;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Login required');
    }
  }
}

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return true;
    const cookie = req.cookies?.[CSRF_COOKIE] as string | undefined;
    const header = req.header('x-csrf-token') || '';
    if (!cookie || cookie.length !== header.length) {
      throw new ForbiddenException('Invalid CSRF token');
    }
    const left = Buffer.from(cookie);
    const right = Buffer.from(header);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
  }
}
