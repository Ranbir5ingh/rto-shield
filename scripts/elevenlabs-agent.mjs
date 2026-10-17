/**
 * Create or update the RTO Shield ElevenLabs agent and register the post-call webhook.
 *
 *   ELEVENLABS_API_KEY=... node --experimental-strip-types scripts/elevenlabs-agent.mjs
 *
 * Optional:
 *   ELEVENLABS_AGENT_ID   update this agent instead of searching by name
 *   ELEVENLABS_WEBHOOK_URL  default https://api.rtoshield.tech/api/elevenlabs/webhook
 *
 * The API key is never printed. A webhook secret is printed only when ElevenLabs issues a new one.
 */
import { syncElevenAgent } from '../apps/api/src/voice/agent-sync.ts';

const key = process.env.ELEVENLABS_API_KEY || '';
if (!key) {
  console.error('Set ELEVENLABS_API_KEY in the environment. The key is not printed.');
  process.exit(1);
}

const webhookUrl = process.env.ELEVENLABS_WEBHOOK_URL || 'https://api.rtoshield.tech/api/elevenlabs/webhook';
const result = await syncElevenAgent({
  apiKey: key,
  knownAgentId: process.env.ELEVENLABS_AGENT_ID || '',
  webhookUrl,
  registerWebhook: true,
});

console.log(`agent_id=${result.agentId}`);
console.log(`created=${result.created}`);
console.log(`webhook_url=${webhookUrl}`);
if (result.webhookId) console.log(`webhook_id=${result.webhookId}`);
console.log('Set ELEVENLABS_AGENT_ID on Render to the agent_id above.');
if (result.webhookSecret) {
  console.log('ElevenLabs issued a webhook secret. Set ELEVENLABS_WEBHOOK_SECRET on Render to the next line. It is shown once and is not saved in the repo.');
  console.log(result.webhookSecret);
} else {
  console.log('No new webhook secret. Keep the existing ELEVENLABS_WEBHOOK_SECRET.');
}
