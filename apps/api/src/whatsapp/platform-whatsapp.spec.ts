import { platformWhatsApp, usesOwnNumber, whatsappCallbackUrl } from './platform-whatsapp';

describe('platform WhatsApp', () => {
  const env = {
    WHATSAPP_PLATFORM_TOKEN: 'EAAG-platform-token',
    WHATSAPP_PLATFORM_PHONE_NUMBER_ID: '15550001111',
    WHATSAPP_PLATFORM_WABA_ID: '15550002222',
    WHATSAPP_PLATFORM_APP_SECRET: 'platform-secret',
  } as NodeJS.ProcessEnv;

  it('reads the platform number only when every field is set', () => {
    expect(platformWhatsApp(env)).toEqual({
      token: 'EAAG-platform-token',
      phoneNumberId: '15550001111',
      wabaId: '15550002222',
      appSecret: 'platform-secret',
    });
    expect(platformWhatsApp({ ...env, WHATSAPP_PLATFORM_TOKEN: '  ' })).toBeNull();
    expect(platformWhatsApp({})).toBeNull();
  });

  it('points the webhook at the API host', () => {
    expect(whatsappCallbackUrl({})).toBe('https://api.rtoshield.tech/api/whatsapp/webhook');
    expect(whatsappCallbackUrl({ SHOPIFY_APP_URL: 'https://www.rtoshield.tech' })).toBe(
      'https://api.rtoshield.tech/api/whatsapp/webhook',
    );
    expect(whatsappCallbackUrl({ WHATSAPP_WEBHOOK_URL: 'https://api.rtoshield.tech/api/whatsapp/webhook' })).toBe(
      'https://api.rtoshield.tech/api/whatsapp/webhook',
    );
    expect(whatsappCallbackUrl({ WHATSAPP_WEBHOOK_URL: 'http://127.0.0.1:4000/' })).toBe(
      'http://127.0.0.1:4000/api/whatsapp/webhook',
    );
  });

  it('keeps a shop on its own number until the owner switches off', () => {
    expect(usesOwnNumber({ tokenEnvelope: { v: 1 }, phoneNumberId: '1', wabaId: '2' })).toBe(true);
    expect(usesOwnNumber({ tokenEnvelope: { v: 1 }, phoneNumberId: '1', wabaId: '2', useOwnNumber: true })).toBe(true);
    expect(usesOwnNumber({ tokenEnvelope: { v: 1 }, phoneNumberId: '1', wabaId: '2', useOwnNumber: false })).toBe(false);
    expect(usesOwnNumber({ phoneNumberId: '1', wabaId: '2' })).toBe(false);
    expect(usesOwnNumber(null)).toBe(false);
  });
});
