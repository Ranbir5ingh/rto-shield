import { WHATSAPP_CALLBACK_URL, WHATSAPP_GUIDE_STEPS, guideProgress } from './whatsapp-guide';

describe('whatsapp guide', () => {
  it('ticks a step only after the matching field is saved or verified', () => {
    expect(guideProgress({})).toEqual({
      app: false,
      number: false,
      ids: false,
      token: false,
      secret: false,
      webhook: false,
      template: false,
    });
    const saved = guideProgress({
      phoneNumberId: '123456',
      wabaId: '654321',
      tokenLast4: 'a1B2',
      appSecretLast4: 'ZZ99',
      templateStatus: 'APPROVED',
      webhookVerified: true,
    });
    expect(Object.values(saved).every(Boolean)).toBe(true);
    expect(guideProgress({ tokenLast4: 'a1B2' }).app).toBe(true);
    expect(guideProgress({ tokenLast4: 'a1B2' }).token).toBe(true);
    expect(guideProgress({ phoneNumberId: '123456' }).ids).toBe(false);
    expect(guideProgress({ templateStatus: 'PENDING' }).template).toBe(false);
  });

  it('keeps the verify token out of the shared guide copy', () => {
    const text = JSON.stringify(WHATSAPP_GUIDE_STEPS);
    expect(text).toMatch(/whatsapp_business_messaging/);
    expect(text).toMatch(/whatsapp_business_management/);
    expect(text).toMatch(/developers\.facebook\.com\/apps\/creation/);
    expect(text).toMatch(/business\.facebook\.com\/latest\/settings\/system_users/);
    expect(text).toMatch(/not published on the public guide/);
    expect(text).toMatch(/confirm your password/);
    expect(WHATSAPP_CALLBACK_URL).toBe('https://api.rtoshield.tech/api/whatsapp/webhook');
    expect(text).toMatch(/Optional/);
    expect(text).not.toMatch(/WHATSAPP_VERIFY_TOKEN|EAA[A-Za-z0-9]/);
  });
});
