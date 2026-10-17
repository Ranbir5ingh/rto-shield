export interface ConnectionCheck {
  id: 'token' | 'waba' | 'template' | 'webhook';
  ok: boolean;
  label: string;
  detail: string;
  hint: string;
}

export type ProbeResult = 'ok' | 'rejected' | 'unreachable' | 'skipped';

export interface ConnectionInput {
  hasToken: boolean;
  hasPhone: boolean;
  hasWaba: boolean;
  phone: ProbeResult;
  waba: ProbeResult;
  templateStatus: string | null;
  webhookVerified: boolean;
}

const TOKEN_HINT =
  'In Meta Business Settings, open System users. Add a system user, then generate a permanent token with whatsapp_business_messaging and whatsapp_business_management. Paste that token in Settings.';
const WABA_HINT =
  'Open WhatsApp Manager, copy the WhatsApp Business Account ID again, and save it in Settings next to the Phone Number ID.';
const WEBHOOK_HINT =
  'In the Meta app, open WhatsApp, then Configuration. Paste the callback URL and the verify token from the setup guide, choose Verify and save, and subscribe to messages.';

export function connectionReport(input: ConnectionInput): { ok: boolean; checks: ConnectionCheck[] } {
  const checks: ConnectionCheck[] = [
    tokenCheck(input),
    wabaCheck(input),
    templateCheck(input),
    webhookCheck(input.webhookVerified),
  ];
  return { ok: checks.every((check) => check.ok), checks };
}

function tokenCheck(input: ConnectionInput): ConnectionCheck {
  const base = { id: 'token' as const, label: 'Access token', hint: TOKEN_HINT };
  if (!input.hasToken || !input.hasPhone || input.phone === 'skipped') {
    return { ...base, ok: false, detail: 'Save the permanent access token and the Phone Number ID first.' };
  }
  if (input.phone === 'unreachable') {
    return { ...base, ok: false, detail: 'WhatsApp did not answer the token check. Try again in a minute.' };
  }
  if (input.phone === 'ok') {
    return { ...base, ok: true, detail: 'Meta accepted the token for this phone number.' };
  }
  return { ...base, ok: false, detail: 'Meta did not accept this token for the Phone Number ID.' };
}

function wabaCheck(input: ConnectionInput): ConnectionCheck {
  const base = { id: 'waba' as const, label: 'WhatsApp Business Account', hint: WABA_HINT };
  if (!input.hasToken || !input.hasWaba || input.waba === 'skipped') {
    return { ...base, ok: false, detail: 'Save the WABA ID from WhatsApp Manager.' };
  }
  if (input.waba === 'unreachable') {
    return { ...base, ok: false, detail: 'WhatsApp did not answer the account check. Try again in a minute.' };
  }
  if (input.waba === 'ok') {
    return { ...base, ok: true, detail: 'This token can open the WhatsApp Business Account.' };
  }
  return { ...base, ok: false, detail: 'This token cannot open that WhatsApp Business Account.' };
}

function templateCheck(input: ConnectionInput): ConnectionCheck {
  const base = { id: 'template' as const, label: 'Order confirmation template' };
  if (!input.hasToken || !input.hasWaba) {
    return {
      ...base,
      ok: false,
      detail: 'Save the token and WABA ID before the template can be checked.',
      hint: 'Submit the order confirmation template from Settings after the token and WABA ID are saved.',
    };
  }
  if (input.templateStatus === null) {
    return {
      ...base,
      ok: false,
      detail: 'WhatsApp did not return the template status.',
      hint: 'Run Test connection again. If it still fails, open WhatsApp Manager and confirm the template is on this account.',
    };
  }
  const status = input.templateStatus.toUpperCase();
  if (status === 'APPROVED') {
    return {
      ...base,
      ok: true,
      detail: 'The order confirmation template is approved, so RTO Shield can message buyers.',
      hint: 'Nothing to change. Meta has approved the template.',
    };
  }
  if (status === 'REJECTED') {
    return {
      ...base,
      ok: false,
      detail: 'Meta rejected the order confirmation template.',
      hint: 'Open WhatsApp Manager, edit the rejected template, and submit it again.',
    };
  }
  if (status === 'PENDING' || status === 'SUBMITTED') {
    return {
      ...base,
      ok: false,
      detail: 'Meta is still reviewing the order confirmation template.',
      hint: 'Wait for Meta to approve it, then run Test connection again. Approval often takes a few minutes.',
    };
  }
  return {
    ...base,
    ok: false,
    detail: 'The order confirmation template is not on this account yet.',
    hint: 'In Settings, choose Submit template, then wait for Meta to approve order_confirmation.',
  };
}

function webhookCheck(verified: boolean): ConnectionCheck {
  return {
    id: 'webhook',
    label: 'Webhook',
    ok: verified,
    detail: verified ? 'Meta has verified the callback URL.' : 'Meta has not verified the webhook yet.',
    hint: WEBHOOK_HINT,
  };
}
