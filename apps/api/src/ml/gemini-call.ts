import type { GeminiCall } from './ml.service';

/**
 * A saved seller key stays on that key. A shop with no key uses the platform
 * Gemini key on the ML service. A key that will not open does not fall through
 * to the platform key.
 */
export function geminiCallFor<T>(
  user: { gemini?: { keyEnvelope?: T | null; validatedAt?: string | null } | null },
  open: (envelope: T) => string,
): GeminiCall | undefined {
  const envelope = user.gemini?.keyEnvelope;
  if (!envelope || !user.gemini?.validatedAt) return undefined;
  try {
    const key = open(envelope);
    if (!key) return { mode: 'seller', key: '' };
    return { mode: 'seller', key };
  } catch {
    return { mode: 'seller', key: '' };
  }
}
