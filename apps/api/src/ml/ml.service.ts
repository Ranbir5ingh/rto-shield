import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { traceSpan } from '../common/trace';
import type { AddressQuality, MlHealth, MlMessage, MlOrder, PredictResponse } from './ml.types';

const HEALTH_MEMORY_MS = 120_000;

export interface GeminiCall {
  mode: 'seller' | 'platform';
  key?: string;
}

@Injectable()
export class MlService {
  private readonly logger = new Logger(MlService.name);
  /** Last /health that answered. A busy fit must not look like an outage. */
  private lastHealth: { at: number; body: MlHealth } | null = null;

  constructor(private readonly config: ConfigService) {}

  private baseUrl() {
    return (this.config.get<string>('ML_SERVICE_URL') || 'http://127.0.0.1:8000').replace(/\/$/, '');
  }

  private headers(gemini?: GeminiCall) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const token = this.config.get<string>('ML_INTERNAL_TOKEN');
    if (token) headers['x-internal-token'] = token;
    if (gemini?.mode === 'seller') {
      headers['x-gemini-mode'] = 'seller';
      headers['x-gemini-key'] = gemini.key || '';
    }
    return headers;
  }

  async predict(
    history: MlOrder[],
    pending: MlOrder[],
    options?: {
      speed?: 'full' | 'fast';
      timeoutMs?: number;
      address?: 'auto' | 'heuristic' | 'gemma';
      gemini?: GeminiCall;
    },
  ): Promise<PredictResponse> {
    const speed = options?.speed ?? 'full';
    const timeoutMs = options?.timeoutMs ?? (speed === 'fast' ? 9_000 : 60_000);
    const address = options?.address ?? (speed === 'fast' ? 'heuristic' : 'auto');
    return traceSpan('invoke_agent rto.score', 'gen_ai.invoke_agent', {
      'gen_ai.operation.name': 'invoke_agent',
      'gen_ai.system': 'rto-shield',
      'gen_ai.request.model': speed === 'fast' ? 'sklearn-fast' : 'tabpfn-or-fallback',
      rows_history: history.length,
      rows_pending: pending.length,
    }, () => this.post<PredictResponse>('/v1/predict', { history, pending, speed, address }, timeoutMs, options?.gemini));
  }

  async addressNotes(
    orders: Array<{ id: string; address: string; city: string; state: string; pincode: string }>,
    gemini?: GeminiCall,
  ): Promise<{
    source: string;
    warnings: string[];
    addresses: Array<{ id: string; address_quality: AddressQuality }>;
  }> {
    return this.post('/v1/address', { orders }, 90_000, gemini);
  }

  async messages(shopName: string, orders: Array<Record<string, unknown>>, gemini?: GeminiCall): Promise<{
    source: string;
    warnings: string[];
    messages: MlMessage[];
  }> {
    return traceSpan('chat gemma.messages', 'gen_ai.chat', {
      'gen_ai.operation.name': 'chat',
      'gen_ai.system': 'gemma',
      'gen_ai.request.model': 'gemma',
      rows: orders.length,
    }, () => this.post('/v1/messages', { shop_name: shopName, orders }, 90_000, gemini));
  }

  async health(timeoutMs = 3000): Promise<MlHealth | null> {
    try {
      const response = await fetch(`${this.baseUrl()}/health`, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) return this.rememberedHealth();
      const body = (await response.json()) as MlHealth;
      this.lastHealth = { at: Date.now(), body };
      return body;
    } catch {
      // TabPFN can pin the CPU for about a minute. A recent success still means the service is up.
      return this.rememberedHealth();
    }
  }

  private rememberedHealth(): MlHealth | null {
    if (!this.lastHealth) return null;
    if (Date.now() - this.lastHealth.at > HEALTH_MEMORY_MS) return null;
    return this.lastHealth.body;
  }

  private async post<T>(path: string, body: unknown, timeoutMs = 60_000, gemini?: GeminiCall): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl()}${path}`, {
        method: 'POST',
        headers: this.headers(gemini),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      this.logger.warn(`ML unreachable: ${error instanceof Error ? error.name : 'error'}`);
      throw new BadGatewayException('Scoring service is not reachable. Start the ML service, or try again.');
    }
    if (!response.ok) {
      this.logger.warn(`ML ${path} status ${response.status}`);
      throw new BadGatewayException('Scoring service rejected the request.');
    }
    return (await response.json()) as T;
  }
}
