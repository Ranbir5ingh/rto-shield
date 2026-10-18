export type Intervention = 'auto_confirm' | 'request_address' | 'offer_prepaid' | 'hold_review' | 'confirm';

export interface ReductionSettings {
  autopilot: boolean;
  prepaidEnabled: boolean;
  discountPct: number;
  minRisk: number;
  escalationMinutes: number;
  noReply: 'hold' | 'cancel';
}

export const DEFAULT_REDUCTION: ReductionSettings = {
  autopilot: true,
  prepaidEnabled: true,
  discountPct: 5,
  minRisk: 60,
  escalationMinutes: 120,
  noReply: 'hold',
};

export interface TimelineEvent {
  at: string;
  step: string;
  detail: string;
}

const FAKE = /fake|refus|prior rto|repeat refus|refused before|suspicious buyer/i;
const WEAK_ADDRESS = /incomplete address|address looks incomplete|landmark|junk address|pincode mismatch|weak address|missing landmark|address incomplete/i;

export function reductionSettings(user: { reduction?: Partial<ReductionSettings> | null }): ReductionSettings {
  const raw = user.reduction;
  return {
    autopilot: raw?.autopilot !== false,
    prepaidEnabled: raw?.prepaidEnabled !== false,
    discountPct: clamp(raw?.discountPct, 0, 50, DEFAULT_REDUCTION.discountPct),
    minRisk: clamp(raw?.minRisk, 0, 100, DEFAULT_REDUCTION.minRisk),
    escalationMinutes: clamp(raw?.escalationMinutes, 0, 24 * 60, DEFAULT_REDUCTION.escalationMinutes),
    noReply: raw?.noReply === 'cancel' ? 'cancel' : 'hold',
  };
}

export function chooseIntervention(input: {
  paymentType: 'cod' | 'prepaid';
  riskScore: number | null;
  riskBand: 'Low' | 'Medium' | 'High' | null;
  reasons: string[];
  priorRtos: number;
  addressQuality: {
    incomplete?: boolean;
    landmark_only?: boolean;
    junk?: boolean;
    pincode_mismatch?: boolean;
  } | null;
  settings: ReductionSettings;
}): { action: Intervention; why: string } {
  const text = (input.reasons || []).join(' ');
  const score = input.riskScore ?? 0;
  const quality = input.addressQuality;

  if (input.priorRtos >= 2 || FAKE.test(text)) {
    return {
      action: 'hold_review',
      why:
        input.priorRtos >= 2
          ? 'Repeat refusals on this buyer. Hold for the seller.'
          : 'The pattern looks like a refusal or a fake order. Hold for the seller.',
    };
  }

  const weak = Boolean(
    quality?.incomplete || quality?.landmark_only || quality?.junk || quality?.pincode_mismatch || WEAK_ADDRESS.test(text),
  );
  if (weak) {
    return {
      action: 'request_address',
      why: 'The address is weak or incomplete. Ask for a landmark and a full pin.',
    };
  }

  const highCod = input.paymentType === 'cod' && (input.riskBand === 'High' || score >= input.settings.minRisk);
  if (highCod && input.settings.prepaidEnabled) {
    return {
      action: 'offer_prepaid',
      why: `High-risk cash on delivery. Offer ${input.settings.discountPct}% off to pay now.`,
    };
  }

  if (input.riskBand === 'Low' || score < 35) {
    return { action: 'auto_confirm', why: 'Low risk. Confirm and let it ship.' };
  }

  return { action: 'confirm', why: 'Ask the buyer to confirm on WhatsApp before it ships.' };
}

export function pushTimeline(existing: TimelineEvent[] | null | undefined, step: string, detail: string, at = new Date()): TimelineEvent[] {
  return [...(existing || []), { at: at.toISOString(), step, detail: detail.slice(0, 240) }];
}

export interface OutreachOrder {
  intervention?: string | null;
  callState?: string | null;
  addressFixedAt?: Date | string | null;
  whatsappStatus?: string | null;
  whatsappMessageId?: string | null;
  exception?: string | null;
  conversation?: Array<{ direction?: string }> | null;
  timeline?: Array<{ step?: string }> | null;
}

/** A buyer was already contacted, or a send was already claimed for this order. */
export function outreachStarted(order: OutreachOrder): boolean {
  if (order.whatsappMessageId) return true;
  if (order.whatsappStatus) return true;
  if (order.exception === 'template_pending' || order.exception === 'send') return true;
  if ((order.conversation || []).some((row) => row.direction === 'out')) return true;
  return (order.timeline || []).some((step) => step.step === 'whatsapp');
}

/** A seller decision, an address fix, or an earlier outreach. A later score must leave the action alone. */
export function actionLocked(order: OutreachOrder): boolean {
  if (order.intervention === 'hold_review' || order.callState === 'held') return true;
  if (order.addressFixedAt) return true;
  if (outreachStarted(order)) return true;
  return (order.timeline || []).some((step) => step.step === 'hold' || step.step === 'action' || step.step === 'auto_confirm');
}

export function buyerReplied(order: { conversation?: Array<{ at: string; direction: 'in' | 'out' }> }): boolean {
  const outbound = (order.conversation || []).filter((item) => item.direction === 'out');
  const last = outbound[outbound.length - 1];
  if (!last) return false;
  return (order.conversation || []).some((item) => item.direction === 'in' && item.at >= last.at);
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
