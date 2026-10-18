export const EXTRA_CALL_LABEL = 'Try one more call';
export const EXTRA_CALL_USED = 'One extra call already used.';
export const DEMO_CALL_LABEL = 'Demo: in the real product, RTO Shield calls the buyer automatically.';

export interface CallStep {
  step: string;
  detail: string;
}

export interface CallResult {
  kind: 'calling' | 'confirmed' | 'address' | 'cancelled' | 'no_answer' | 'simulated' | 'prepaid';
  label: string;
  answered: boolean;
}

export function autopilotAttempts(order: { timeline?: CallStep[]; callState?: string | null }): number {
  const attempts = (order.timeline || []).filter((step) => step.step === 'call' && !/^Call finished\b/i.test(step.detail)).length;
  if (attempts > 0) return attempts;
  if (order.callState === 'called' || order.callState === 'simulated' || order.callState === 'held') return 1;
  return 0;
}

/** Subline under Try one more call. The example shape is "Autopilot called 2 times, no answer". */
export function autopilotCallLine(order: { timeline?: CallStep[]; callState?: string | null }): string {
  const count = autopilotAttempts(order);
  if (count <= 0) return 'Autopilot has not called.';
  const times = count === 1 ? '1 time' : `${count} times`;
  if (order.callState === 'called') return `Autopilot called ${times}.`;
  return `Autopilot called ${times}, no answer`;
}

export function extraCallResult(outcome: string | null | undefined): CallResult | null {
  switch (outcome) {
    case 'confirmed':
      return { kind: 'confirmed', label: 'Confirmed', answered: true };
    case 'address':
      return { kind: 'address', label: 'Address changed', answered: true };
    case 'cancelled':
      return { kind: 'cancelled', label: 'Cancelled', answered: true };
    case 'prepaid':
      return { kind: 'prepaid', label: 'Prepaid', answered: true };
    case 'no_answer':
      return { kind: 'no_answer', label: 'No answer', answered: false };
    case 'simulated':
      return { kind: 'simulated', label: 'Simulated call', answered: false };
    case 'calling':
      return { kind: 'calling', label: 'Calling', answered: false };
    default:
      return null;
  }
}

export function outcomeAfter(order: { timeline?: CallStep[] }, index: number): CallResult | null {
  const steps = (order.timeline || []).slice(Math.max(0, index));
  for (let cursor = steps.length - 1; cursor >= 0; cursor -= 1) {
    const step = steps[cursor];
    if (!step) continue;
    if (/^Simulated call\b/i.test(step.detail)) return extraCallResult('simulated');
    const finished = /^Call finished:\s*([a-z_]+)/i.exec(step.detail);
    if (finished?.[1]) {
      const outcome = finished[1] === 'no_response' ? 'no_answer' : finished[1];
      const mapped = extraCallResult(outcome);
      if (mapped) return mapped;
    }
    if (step.step === 'extra_call') {
      if (step.detail === 'Confirmed') return extraCallResult('confirmed');
      if (step.detail === 'Cancelled') return extraCallResult('cancelled');
      if (step.detail === 'Address changed') return extraCallResult('address');
      if (step.detail === 'No answer') return extraCallResult('no_answer');
    }
  }
  return null;
}
