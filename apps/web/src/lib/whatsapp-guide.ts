export const WHATSAPP_CALLBACK_URL = 'https://www.rtoshield.tech/api/whatsapp/webhook';

export interface GuideLink {
  label: string;
  href: string;
}

export interface GuideStep {
  id: 'app' | 'number' | 'ids' | 'token' | 'secret' | 'webhook' | 'template';
  title: string;
  body: string;
  links: GuideLink[];
}

export interface GuideProgressInput {
  phoneNumberId?: string;
  wabaId?: string;
  tokenLast4?: string;
  appSecretLast4?: string;
  templateStatus?: string;
  webhookVerified?: boolean;
}

export const WHATSAPP_GUIDE_STEPS: GuideStep[] = [
  {
    id: 'app',
    title: 'Create a Meta developer app',
    body: 'Optional. RTO Shield already sends from its number. Create a Meta app only if buyers should see yours. The app later holds the token, secret, and webhook.',
    links: [
      { label: 'Create an app', href: 'https://developers.facebook.com/apps/creation/' },
      { label: 'WhatsApp Cloud API get started', href: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started' },
    ],
  },
  {
    id: 'number',
    title: 'Claim the test number or add your own',
    body: 'WhatsApp gives a test number you can claim, or you can add the shop number you already use. Finish the display name so Meta shows the number as yours.',
    links: [{ label: 'Phone numbers in WhatsApp Manager', href: 'https://business.facebook.com/latest/whatsapp_manager/phone_numbers' }],
  },
  {
    id: 'ids',
    title: 'Copy the Phone Number ID and WABA ID',
    body: 'The Phone Number ID is on the phone number in WhatsApp Manager. The WABA ID is the WhatsApp Business Account ID on the account overview. Both are long numbers. Paste them into RTO Shield Settings.',
    links: [
      { label: 'Phone numbers', href: 'https://business.facebook.com/latest/whatsapp_manager/phone_numbers' },
      { label: 'WhatsApp account overview', href: 'https://business.facebook.com/latest/whatsapp_manager/overview' },
    ],
  },
  {
    id: 'token',
    title: 'Create a permanent token',
    body: 'In Business Settings, open System users and add a system user. Generate a token that does not expire. It needs the permissions whatsapp_business_messaging and whatsapp_business_management. Paste that token into Settings. A temporary token from the developer console stops working.',
    links: [
      { label: 'System users', href: 'https://business.facebook.com/latest/settings/system_users' },
      { label: 'Business token guide', href: 'https://developers.facebook.com/docs/whatsapp/business-management-api/get-started' },
    ],
  },
  {
    id: 'secret',
    title: 'Copy the App secret',
    body: 'Open the app, then App settings, then Basic. Copy the App secret and paste it into Settings. RTO Shield uses it to confirm that replies really came from Meta.',
    links: [
      { label: 'Your apps', href: 'https://developers.facebook.com/apps/' },
      { label: 'Basic settings', href: 'https://developers.facebook.com/docs/development/create-an-app/app-dashboard/basic-settings' },
    ],
  },
  {
    id: 'webhook',
    title: 'Set the webhook and subscribe to messages',
    body: 'In the app, open WhatsApp, then Configuration. Paste the callback URL and the verify token, choose Verify and save, and subscribe to the messages field. The verify token is shown in Settings after you log in. It is not published on the public guide.',
    links: [{ label: 'Webhook setup', href: 'https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks' }],
  },
  {
    id: 'template',
    title: 'Get the template approved',
    body: 'In Settings, submit the order confirmation template. Meta reviews it. Until the status says approved, RTO Shield can only prepare the message. You can also watch the review in WhatsApp Manager.',
    links: [
      { label: 'Message templates', href: 'https://business.facebook.com/latest/whatsapp_manager/message_templates' },
      { label: 'Template guide', href: 'https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates' },
    ],
  },
];

export function guideProgress(input: GuideProgressInput): Record<GuideStep['id'], boolean> {
  const phone = Boolean(input.phoneNumberId?.trim());
  const waba = Boolean(input.wabaId?.trim());
  const token = Boolean(input.tokenLast4?.trim());
  const secret = Boolean(input.appSecretLast4?.trim());
  return {
    app: phone || token,
    number: phone,
    ids: phone && waba,
    token,
    secret,
    webhook: Boolean(input.webhookVerified),
    template: input.templateStatus === 'APPROVED',
  };
}
