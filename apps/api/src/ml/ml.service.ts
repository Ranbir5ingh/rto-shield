import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { traceSpan } from '../common/trace';
import type { MlHealth, MlMessage, MlOrder, PredictResponse } from './ml.types';

@Injectable()
export class MlService {
  private readonly logger = new Logger(MlService.name);

  constructor(private readonly config: ConfigService) {}

  private baseUrl() {
    return (this.config.get<string>('ML_SERVICE_URL') || 'http://127.0.0.1:8000').replace(/\/$/, '');
  }

  private headers() {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const token = this.config.get<string>('ML_INTERNAL_TOKEN');
    if (token) headers['x-internal-token'] = token;
    return headers;
  }

  async predict(
    history: MlOrder[],
    pending: MlOrder[],
    options?: { speed?: 'full' | 'fast'; timeoutMs?: number },
  ): Promise<PredictResponse> {
    const speed = options?.speed ?? 'full';
    const timeoutMs = options?.timeoutMs ?? (speed === 'fast' ? 12_000 : 60_000);
    return traceSpan('invoke_agent rto.score', 'gen_ai.invoke_agent', {
      'gen_ai.operation.name': 'invoke_agent',
      'gen_ai.system': 'rto-shield',
      'gen_ai.request.model': speed === 'fast' ? 'sklearn-fast' : 'tabpfn-or-fallback',
      rows_history: history.length,
      rows_pending: pending.length,
    }, () => this.post<PredictResponse>('/v1/predict', { history, pending, speed }, timeoutMs));
  }

  async messages(shopName: string, orders: Array<Record<string, unknown>>): Promise<{
    source: string;
    warnings: string[];
    messages: MlMessage[];
  }> {
    return traceSpan('chat gemma.messages', 'gen_ai.chat', {
      'gen_ai.operation.name': 'chat',
      'gen_ai.system': 'gemma',
      'gen_ai.request.model': 'gemma',
      rows: orders.length,
    }, () => this.post('/v1/messages', { shop_name: shopName, orders }, 20_000));
  }

  async health(timeoutMs = 3000): Promise<MlHealth | null> {
    try {
      const response = await fetch(`${this.baseUrl()}/health`, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) return null;
      return (await response.json()) as MlHealth;
    } catch {
      return null;
    }
  }

  private async post<T>(path: string, body: unknown, timeoutMs = 60_000): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl()}${path}`, {
        method: 'POST',
        headers: this.headers(),
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
