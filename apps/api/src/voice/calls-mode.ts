export type CallsMode = 'simulated' | 'browser' | 'live';

export function callsMode(env: NodeJS.ProcessEnv = process.env): CallsMode {
  const value = (env.CALLS_MODE || 'browser').trim().toLowerCase();
  if (value === 'simulated' || value === 'live' || value === 'browser') return value;
  return 'browser';
}

export interface CallDecisionInput {
  mode: CallsMode;
  prefer: 'phone' | 'browser';
  allowPhone: boolean;
  hasKey: boolean;
  hasPhoneId: boolean;
}

export type CallKind = 'simulated' | 'browser' | 'phone';

const SIMULATED = 'Simulated call. The buyer was not dialed.';

/** Free test mode is browser for the button and simulated for outbound. live dials only with a phone number id. */
export function planCall(input: CallDecisionInput): { kind: CallKind; notice: string | null } {
  if (input.mode === 'simulated') return { kind: 'simulated', notice: SIMULATED };
  const outbound = input.prefer === 'phone';
  if (input.mode === 'live' && outbound && input.allowPhone && input.hasKey && input.hasPhoneId) {
    return { kind: 'phone', notice: null };
  }
  if (outbound) return { kind: 'simulated', notice: SIMULATED };
  if (!input.hasKey) return { kind: 'simulated', notice: SIMULATED };
  return { kind: 'browser', notice: null };
}
