import { connectionReport } from './whatsapp-connection';

describe('connectionReport', () => {
  const ready = {
    hasToken: true,
    hasPhone: true,
    hasWaba: true,
    phone: 'ok' as const,
    waba: 'ok' as const,
    templateStatus: 'APPROVED',
    webhookVerified: true,
  };

  it('passes every check when Meta accepted the token, account, template, and webhook', () => {
    const report = connectionReport(ready);
    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.id)).toEqual(['token', 'waba', 'template', 'webhook']);
    expect(report.checks.every((check) => check.ok && check.detail && check.hint)).toBe(true);
  });

  it('explains a missing setup without calling the failure a Meta rejection', () => {
    const report = connectionReport({
      ...ready,
      hasToken: false,
      hasPhone: false,
      hasWaba: false,
      phone: 'skipped',
      waba: 'skipped',
      templateStatus: 'missing',
      webhookVerified: false,
    });
    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.id === 'token')?.detail).toMatch(/Save the permanent access token/);
    expect(report.checks.find((check) => check.id === 'token')?.hint).toMatch(/whatsapp_business_messaging/);
    expect(report.checks.find((check) => check.id === 'waba')?.hint).toMatch(/WhatsApp Business Account ID/);
    expect(report.checks.find((check) => check.id === 'webhook')?.hint).toMatch(/Verify and save/);
    expect(JSON.stringify(report)).not.toMatch(/EAA|Bearer |whatsapp-verify/);
  });

  it('gives a different hint when the template was rejected', () => {
    const report = connectionReport({ ...ready, templateStatus: 'REJECTED', webhookVerified: false });
    const template = report.checks.find((check) => check.id === 'template');
    expect(template?.ok).toBe(false);
    expect(template?.hint).toMatch(/edit the rejected template/i);
    expect(report.checks.find((check) => check.id === 'webhook')?.ok).toBe(false);
  });

  it('says WhatsApp did not answer when the probe could not connect', () => {
    const report = connectionReport({ ...ready, phone: 'unreachable', waba: 'unreachable', templateStatus: null });
    expect(report.checks.find((check) => check.id === 'token')?.detail).toMatch(/did not answer/);
    expect(report.checks.find((check) => check.id === 'template')?.detail).toMatch(/did not return/);
  });
});
