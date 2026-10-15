import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';

const logger = new Logger('trace');

export async function traceSpan<T>(
  name: string,
  op: string,
  attributes: Record<string, string | number | boolean | null>,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  const finish = (error: boolean) => {
    if (process.env.NODE_ENV === 'test') return;
    logger.log(
      JSON.stringify({
        span: name,
        op,
        latency_ms: Date.now() - start,
        error,
        ...attributes,
      }),
    );
  };

  if (!process.env.SENTRY_DSN) {
    try {
      const result = await fn();
      finish(false);
      return result;
    } catch (error) {
      finish(true);
      throw error;
    }
  }

  return Sentry.startSpan({ name, op }, async (span) => {
    const started = Date.now();
    try {
      const result = await fn();
      span.setAttribute('latency_ms', Date.now() - started);
      for (const [key, value] of Object.entries(attributes)) {
        if (value !== null && value !== undefined) span.setAttribute(key, value);
      }
      finish(false);
      return result;
    } catch (error) {
      span.setAttribute('error', true);
      span.setAttribute('latency_ms', Date.now() - started);
      finish(true);
      throw error;
    }
  });
}
