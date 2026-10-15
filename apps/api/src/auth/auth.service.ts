import { ConflictException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import { Model } from 'mongoose';
import { clearSessionCookies, CSRF_COOKIE, cookieOptions, writeSessionCookies } from '../common/cookies';
import type { AccessPayload } from '../common/guards';
import type { LoginInput, SignupInput } from '../common/validation';
import { User, type UserDocument } from '../database/user.schema';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  shopName: string;
  rtoCostInr: number;
  messageLanguage: 'hindi' | 'hinglish' | 'english';
}

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await bcrypt.hash('not-a-real-password', this.rounds());
  }

  private rounds() {
    return Number(process.env.BCRYPT_ROUNDS || 12);
  }

  toPublic(user: UserDocument): PublicUser {
    return {
      id: String(user._id),
      email: user.email,
      name: user.name,
      shopName: user.shopName,
      rtoCostInr: user.rtoCostInr,
      messageLanguage: user.messageLanguage,
    };
  }

  private async issue(user: UserDocument) {
    const access = await this.jwt.signAsync(
      { sub: String(user._id), tv: user.tokenVersion, typ: 'access' } satisfies AccessPayload,
      { expiresIn: '15m' },
    );
    const refresh = await this.jwt.signAsync(
      { sub: String(user._id), tv: user.tokenVersion, typ: 'refresh' } satisfies AccessPayload,
      { expiresIn: '7d' },
    );
    return { access, refresh, csrf: randomBytes(32).toString('hex'), user: this.toPublic(user) };
  }

  writeSession(res: Response, session: { access: string; refresh: string; csrf: string }) {
    writeSessionCookies(res, this.config, session);
  }

  setCsrf(res: Response, token: string) {
    res.cookie(CSRF_COOKIE, token, cookieOptions(this.config, false, 7 * 24 * 60 * 60 * 1000));
  }

  clearSession(res: Response) {
    clearSessionCookies(res, this.config);
  }

  csrfToken() {
    return randomBytes(32).toString('hex');
  }

  async createDemo() {
    const email = `demo+${randomBytes(4).toString('hex')}@demo.rtoshield.tech`;
    const passwordHash = await bcrypt.hash(randomBytes(18).toString('base64url'), this.rounds());
    const user = await this.users.create({
      email,
      passwordHash,
      name: 'Asha Mehra',
      shopName: 'Asha Studio',
      messageLanguage: 'hinglish',
      rtoCostInr: 150,
    });
    return { session: await this.issue(user), user };
  }

  async signup(input: SignupInput) {
    const passwordHash = await bcrypt.hash(input.password, this.rounds());
    try {
      const user = await this.users.create({
        email: input.email,
        passwordHash,
        name: input.name,
        shopName: input.shopName,
      });
      return this.issue(user);
    } catch (error) {
      if (error && typeof error === 'object' && (error as { code?: number }).code === 11000) {
        throw new ConflictException('An account with that email already exists');
      }
      throw error;
    }
  }

  async login(input: LoginInput) {
    const user = await this.users.findOne({ email: input.email });
    const ok = await bcrypt.compare(input.password, user?.passwordHash ?? this.dummyHash);
    if (!user || !ok) throw new UnauthorizedException('Invalid email or password');
    return this.issue(user);
  }

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) throw new UnauthorizedException('Login required');
    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Login required');
    }
    if (payload.typ !== 'refresh') throw new UnauthorizedException('Login required');
    const user = await this.users.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.tv) throw new UnauthorizedException('Login required');
    user.tokenVersion += 1;
    await user.save();
    return this.issue(user);
  }

  async logout(token: string | undefined) {
    if (!token) return;
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(token, { ignoreExpiration: true });
      if (payload?.sub) {
        await this.users.updateOne({ _id: payload.sub }, { $inc: { tokenVersion: 1 } });
      }
    } catch {
      return;
    }
  }
}
