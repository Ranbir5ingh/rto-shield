import { BadRequestException, Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VaultService } from '../common/vault.service';
import { AuditEvent } from '../database/audit.schema';
import { PlatformFlag } from '../database/platform.schema';
import type { UserDocument } from '../database/user.schema';
import { isDemoSession } from '../demo/demo.policy';
import { syncElevenAgent, webhookTarget, type SyncResult } from './agent-sync';
import { callsMode, planCall } from './calls-mode';
import { parseCallOutcome, verifyElevenSignature, type ParsedCall } from './elevenlabs';

export const ELEVEN_AGENT_PLATFORM_KEY = 'elevenlabs.agentId';

function publicSyncError(error: unknown): string {
  if (!(error instanceof Error)) return 'error';
  if (/^(missing-(key|agent-id|webhook-id)|elevenlabs-(\d+|unreachable))$/.test(error.message)) return error.message;
  return error.name || 'error';
}

export interface CallVariables {
  order_id: string;
  rto_order: string;
  shop_name: string;
  amount: string;
  action: string;
  discount: string;
}

export interface CallPlan {
  mode: 'phone' | 'browser' | 'simulated';
  signedUrl: string | null;
  variables: CallVariables;
  notice: string | null;
  conversationId: string;
}

@Injectable()
export class ElevenLabsService implements OnModuleInit {
  private readonly logger = new Logger(ElevenLabsService.name);

  constructor(
    private readonly vault: VaultService,
    @InjectModel(PlatformFlag.name) private readonly platform: Model<PlatformFlag>,
    @InjectModel(AuditEvent.name) private readonly audit: Model<AuditEvent>,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    if (!process.env.ELEVENLABS_API_KEY) return;
    void this.syncFromEnv(false).catch((error: unknown) => {
      this.logger.warn(`ElevenLabs agent sync missed: ${publicSyncError(error)}`);
    });
  }

  status(user: UserDocument) {
    const visitor = isDemoSession(user);
    return {
      configured: Boolean(this.keyFor(user)),
      last4: visitor ? '' : user.elevenlabs?.last4 || '',
      phone: Boolean(process.env.ELEVENLABS_PHONE_NUMBER_ID),
      agent: Boolean(process.env.ELEVENLABS_AGENT_ID),
    };
  }

  async save(user: UserDocument, apiKey?: string) {
    if (user.role === 'staff') throw new BadRequestException('Only the shop owner can change connections');
    const key = apiKey?.trim() || '';
    if (!key) return this.status(user);
    if (key.length < 20) throw new BadRequestException('ElevenLabs did not accept that key');
    user.elevenlabs = { keyEnvelope: this.vault.seal(key), last4: this.vault.mask(key) };
    await user.save();
    await this.audit.create({ sellerId: user._id, action: 'elevenlabs.save', meta: { last4: user.elevenlabs.last4 } });
    return this.status(user);
  }

  async clear(user: UserDocument) {
    if (user.role === 'staff') throw new BadRequestException('Only the shop owner can change connections');
    user.elevenlabs = null;
    await user.save();
    await this.audit.create({ sellerId: user._id, action: 'elevenlabs.clear', meta: {} });
    return this.status(user);
  }

  keyFor(user: UserDocument): string {
    if (user.elevenlabs?.keyEnvelope) {
      try {
        return this.vault.open(user.elevenlabs.keyEnvelope);
      } catch {
        return '';
      }
    }
    return process.env.ELEVENLABS_API_KEY || '';
  }

  /** Updates the named agent. Webhook registration is opt-in so boot does not rotate the secret. */
  async syncFromEnv(registerWebhook: boolean): Promise<SyncResult> {
    const key = process.env.ELEVENLABS_API_KEY || '';
    if (!key) throw new BadRequestException('ELEVENLABS_API_KEY is not set on the server');
    const stored = await this.platform.findOne({ key: ELEVEN_AGENT_PLATFORM_KEY }).lean();
    let result: SyncResult;
    try {
      result = await syncElevenAgent({
        apiKey: key,
        knownAgentId: process.env.ELEVENLABS_AGENT_ID || stored?.value || '',
        webhookUrl: webhookTarget(),
        registerWebhook,
      });
    } catch (error) {
      this.logger.warn(`ElevenLabs agent sync missed: ${publicSyncError(error)}`);
      throw new BadRequestException('ElevenLabs could not save the voice agent');
    }
    await this.platform.updateOne({ key: ELEVEN_AGENT_PLATFORM_KEY }, { $set: { value: result.agentId } }, { upsert: true });
    return result;
  }

  /**
   * Phone calls leave the building only when a Twilio number is configured.
   * prefer "phone" is the sweep: it does not mint a signed URL.
   */
  async place(_user: UserDocument, variables: CallVariables, phone: string | null, allowPhone: boolean, prefer: 'phone' | 'browser'): Promise<CallPlan> {
    const key = process.env.ELEVENLABS_API_KEY || '';
    const phoneId = process.env.ELEVENLABS_PHONE_NUMBER_ID || '';
    const decision = planCall({
      mode: callsMode(),
      prefer,
      allowPhone: Boolean(allowPhone && phone),
      hasKey: Boolean(key),
      hasPhoneId: Boolean(phoneId),
    });
    if (decision.kind === 'simulated') {
      return {
        mode: 'simulated',
        signedUrl: null,
        variables,
        notice: decision.notice,
        conversationId: `sim-${variables.rto_order}`.slice(0, 80),
      };
    }
    if (decision.kind === 'phone' && phone) {
      const conversationId = await this.outbound(key, variables, phone, phoneId);
      return { mode: 'phone', signedUrl: null, variables, notice: null, conversationId };
    }
    const signedUrl = await this.signedUrl(key);
    return { mode: 'browser', signedUrl, variables, notice: decision.notice, conversationId: '' };
  }

  acceptWebhook(raw: Buffer, header: string): ParsedCall {
    const secret = process.env.ELEVENLABS_WEBHOOK_SECRET || '';
    if (!secret || !verifyElevenSignature(raw, header, secret)) {
      throw new UnauthorizedException('Invalid signature');
    }
    try {
      return parseCallOutcome(JSON.parse(raw.toString('utf8')) as unknown);
    } catch {
      throw new BadRequestException('Webhook body was not JSON');
    }
  }

  private async outbound(key: string, variables: CallVariables, phone: string, phoneId: string): Promise<string> {
    const agentId = await this.agentId();
    const response = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'xi-api-key': key },
      body: JSON.stringify({
        agent_id: agentId,
        agent_phone_number_id: phoneId,
        to_number: phone.startsWith('+') ? phone : `+${phone}`,
        conversation_initiation_client_data: { dynamic_variables: variables },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      this.logger.warn(`ElevenLabs outbound missed: HTTP ${response.status}`);
      throw new BadRequestException('ElevenLabs could not place the call');
    }
    const body = (await response.json()) as { conversation_id?: string; callSid?: string };
    return String(body.conversation_id || body.callSid || '').slice(0, 80);
  }

  private async signedUrl(key: string): Promise<string> {
    const agentId = await this.agentId();
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { 'xi-api-key': key }, signal: AbortSignal.timeout(15_000) },
    );
    if (!response.ok) {
      this.logger.warn(`ElevenLabs signed URL missed: HTTP ${response.status}`);
      throw new BadRequestException('ElevenLabs could not start the browser call');
    }
    const body = (await response.json()) as { signed_url?: string };
    if (!body.signed_url) throw new BadRequestException('ElevenLabs could not start the browser call');
    return body.signed_url;
  }

  private async agentId(): Promise<string> {
    const fromEnv = (process.env.ELEVENLABS_AGENT_ID || '').trim();
    if (fromEnv) return fromEnv;
    const stored = await this.platform.findOne({ key: ELEVEN_AGENT_PLATFORM_KEY }).lean();
    if (stored?.value) return stored.value;
    const synced = await this.syncFromEnv(false);
    return synced.agentId;
  }
}
