import { ConflictException, Injectable, OnModuleInit, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
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
import { AuditEvent } from '../database/audit.schema';
import { DemoSession } from '../database/demo-session.schema';
import { User, type UserDocument } from '../database/user.schema';
import { demoSessionMs, effectiveRole, hashDemoIp, isOfficialDemoAccount } from '../demo/demo.policy';
import { reductionSettings } from '../orders/action';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  shopName: string;
  rtoCostInr: number;
  messageLanguage: 'hindi' | 'hinglish' | 'english';
  role: 'owner' | 'staff' | 'demo';
  isDemo: boolean;
  officialDemo: boolean;
  tour: { sellerSeen: boolean; demoSeen: boolean };
  reduction: {
    autopilot: boolean;
    prepaidEnabled: boolean;
    discountPct: number;
    minRisk: number;
    escalationMinutes: number;
    noReply: 'hold' | 'cancel';
  };
  elevenlabsConfigured: boolean;
  elevenlabsLast4: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(DemoSession.name) private readonly demoSessions: Model<DemoSession>,
    @InjectModel(AuditEvent.name) private readonly audit: Model<AuditEvent>,
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
      role: effectiveRole(user),
      isDemo: Boolean(user.isDemo),
      officialDemo: isOfficialDemoAccount(user.email),
      tour: {
        sellerSeen: Boolean(user.sellerTourSeenAt),
        demoSeen: user.$locals?.actor === 'demo' ? Boolean(user.$locals?.demoTourSeen) : Boolean(user.demoTourSeenAt),
      },
      reduction: reductionSettings(user),
      elevenlabsConfigured: Boolean(user.elevenlabs?.keyEnvelope || process.env.ELEVENLABS_API_KEY),
      elevenlabsLast4: effectiveRole(user) === 'demo' ? '' : user.elevenlabs?.last4 || '',
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

  writeSession(res: Response, session: { access: string; refresh: string; csrf: string }, ttl?: { accessMs?: number; refreshMs?: number }) {
    writeSessionCookies(res, this.config, session, ttl);
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

  async openLiveDemo(ip: string) {
    const email = (process.env.DEMO_ACCOUNT_EMAIL || '').trim().toLowerCase();
    const user = email ? await this.users.findOne({ email }) : null;
    const link = user?.shopify;
    const connected = Boolean(link && !link.uninstalledAt && (link.demo || link.tokenEnvelope));
    if (!user || !connected) throw new ServiceUnavailableException('The live demo shop is not ready');
    const expiresAt = new Date(Date.now() + demoSessionMs());
    const created = await this.demoSessions.create({
      userId: user._id,
      expiresAt,
      tourSeen: false,
      ipHash: hashDemoIp(ip),
    });
    user.$locals.actor = 'demo';
    user.$locals.demoTourSeen = false;
    user.$locals.demoSessionId = String(created._id);
    const session = await this.issueDemo(user, String(created._id), expiresAt);
    await this.audit.create({
      sellerId: user._id,
      action: 'demo.session',
      meta: { ipHash: hashDemoIp(ip) },
    });
    return session;
  }

  private async issueDemo(user: UserDocument, sessionId: string, expiresAt: Date) {
    const seconds = Math.max(60, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    const claims = { sub: String(user._id), tv: user.tokenVersion, actor: 'demo' as const, sid: sessionId };
    const access = await this.jwt.signAsync({ ...claims, typ: 'access' } satisfies AccessPayload, { expiresIn: seconds });
    const refresh = await this.jwt.signAsync({ ...claims, typ: 'refresh' } satisfies AccessPayload, { expiresIn: seconds });
    return { access, refresh, csrf: randomBytes(32).toString('hex'), user: this.toPublic(user) };
  }

  async createDemo() {
    const email = `demo+${randomBytes(4).toString('hex')}@demo.rtoshield.tech`;
    // The password is random and never shown. Cost 12 of pure-JS bcrypt
    // occupies a free-tier CPU for many seconds, which was most of the demo wait.
    const passwordHash = await bcrypt.hash(randomBytes(18).toString('base64url'), 6);
    const user = await this.users.create({
      email,
      passwordHash,
      name: 'Asha Mehra',
      shopName: 'Asha Studio',
      messageLanguage: 'hinglish',
      rtoCostInr: 150,
      isDemo: true,
      role: 'owner',
      shopify: {
        shopDomain: 'asha-studio.myshopify.com',
        demo: true,
        scopes: 'read_orders,write_orders,read_fulfillments,read_customers',
        tokenEnvelope: null,
        installedAt: new Date().toISOString(),
        uninstalledAt: null,
        backfill: { status: 'done', processed: 204, total: 204, error: null },
        riskTags: { high: 'rto-high', medium: 'rto-medium', low: 'rto-low' },
        rtoTag: 'RTO',
        autoCancelOnBuyerCancel: false,
      },
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
    if (payload.actor === 'demo') return this.refreshDemo(payload);
    const user = await this.users.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.tv) throw new UnauthorizedException('Login required');
    user.tokenVersion += 1;
    await user.save();
    return this.issue(user);
  }

  private async refreshDemo(payload: AccessPayload) {
    if (!payload.sid) throw new UnauthorizedException('Login required');
    const demo = await this.demoSessions.findById(payload.sid);
    if (!demo || demo.expiresAt.getTime() <= Date.now() || String(demo.userId) !== payload.sub) {
      throw new UnauthorizedException('Login required');
    }
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Login required');
    user.$locals.actor = 'demo';
    user.$locals.demoTourSeen = Boolean(demo.tourSeen);
    user.$locals.demoSessionId = String(demo._id);
    return this.issueDemo(user, String(demo._id), demo.expiresAt);
  }

  async logout(token: string | undefined) {
    if (!token) return;
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(token, { ignoreExpiration: true });
      if (payload?.actor === 'demo' && payload.sid) {
        await this.demoSessions.deleteOne({ _id: payload.sid });
        return;
      }
      if (payload?.sub) {
        await this.users.updateOne({ _id: payload.sub }, { $inc: { tokenVersion: 1 } });
      }
    } catch {
      return;
    }
  }
}
