# Production switch

Free test mode works with the current WhatsApp test number and without a paid calling number. Going live is a config change. No code change and no seller setup.

## Free test mode (today)

Leave these as they are:

- `CALLS_MODE=browser` (or unset). Call the buyer uses a free ElevenLabs signed URL in the browser when `ELEVENLABS_API_KEY` is set. Outbound escalation is a simulated call and does not dial the buyer.
- WhatsApp sends from RTO Shield's test number:

```
WHATSAPP_PLATFORM_TOKEN
WHATSAPP_PLATFORM_PHONE_NUMBER_ID
WHATSAPP_PLATFORM_WABA_ID
WHATSAPP_PLATFORM_APP_SECRET
WHATSAPP_VERIFY_TOKEN
```

The webhook URL is `https://api.rtoshield.tech/api/whatsapp/webhook`. Settings and the setup guide show that same API host. Templates live on that WABA. Each message already carries the shop name and the order. Sellers do not paste a token. The verify token stays masked until the shop owner confirms their password.

## WhatsApp live

1. Finish Meta business verification and add a paid WhatsApp Business number on the same platform WABA, or replace the test WABA.
2. Put the live token, phone number id, WABA id, and app secret in the four `WHATSAPP_PLATFORM_*` variables.
3. In the Meta app, set the callback URL and `WHATSAPP_VERIFY_TOKEN`, then subscribe to `messages`.
4. Confirm the store-name templates (`*_v2` when approved) are `APPROVED` on that WABA.

A shop that wants buyers to see its own number turns on **Use my own WhatsApp Business number** in Settings. That stores the shop token encrypted and moves only that shop's sends and webhook onto its number. Turning it off returns the shop to the platform number.

## Calls live

1. Import a Twilio number into ElevenLabs. This is the paid step.
2. Set `ELEVENLABS_PHONE_NUMBER_ID` to that number's id.
3. Set `CALLS_MODE=live`.

`CALLS_MODE=simulated` keeps every call on screen and dials nobody. `browser` is the free default. `live` places an outbound call only when the phone number id is set. There is no seller ElevenLabs key.

## Platform Gemini

`GEMINI_API_KEY` is a platform env var on the ML service. Sellers do not paste a key, and the app has no Gemini key field. Address notes and confirmation drafts use that key. If it is unset, or Gemini does not answer, those notes fall back to the built-in templates and scoring continues. `OLLAMA_BASE_URL`, when set on the same service, is preferred over the hosted key.

## Render variables

Set these on the API service. Do not commit the values.

| Variable | Test mode | Live |
| --- | --- | --- |
| `WHATSAPP_PLATFORM_TOKEN` | Test-number token | Live number token |
| `WHATSAPP_PLATFORM_PHONE_NUMBER_ID` | Test phone number id | Live phone number id |
| `WHATSAPP_PLATFORM_WABA_ID` | Test WABA id | Live WABA id |
| `WHATSAPP_PLATFORM_APP_SECRET` | Meta app secret | Same app, or the live app secret |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verify token | Same |
| `CALLS_MODE` | `browser` | `live` |
| `ELEVENLABS_API_KEY` | Platform key, for browser calls and tour audio | Same |
| `ELEVENLABS_PHONE_NUMBER_ID` | Empty | Twilio number id in ElevenLabs |
| `ELEVENLABS_AGENT_ID` | Optional. Created on boot when empty | Same |
| `ELEVENLABS_WEBHOOK_SECRET` | Set when call outcomes should close orders | Same |
| `GEMINI_API_KEY` | ML service only. Platform key. Empty uses templates | Same |
