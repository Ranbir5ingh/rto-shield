/** Shared with scripts/elevenlabs-agent.mjs. Never log the API key or webhook secret. */

export const ELEVEN_AGENT_NAME = 'RTO Shield order desk';
const API = 'https://api.elevenlabs.io/v1';

export const AGENT_PROMPT = `You are the order desk for {{shop_name}}. Speak Hindi, Hinglish, or English, matching the buyer.
The order number is {{order_id}} for Rs {{amount}}. The next step is {{action}}. A prepaid offer, when relevant, is {{discount}} percent off.
Confirm the order if they agree. If they want to cancel, accept politely.
If the address is weak, ask for a landmark and a complete address. Never ask for or repeat a phone number, and never ask for a card or an OTP.
If they want to pay now, say the checkout link will arrive on WhatsApp.
End with one outcome: confirmed, cancelled, address, prepaid, or no_response.`;

export interface SyncResult {
  agentId: string;
  created: boolean;
  webhookId: string | null;
  webhookSecret: string | null;
}

export function webhookTarget(): string {
  const explicit = (process.env.ELEVENLABS_WEBHOOK_URL || process.env.API_PUBLIC_URL || '').replace(/\/$/, '');
  if (explicit && explicit.includes('/elevenlabs/webhook')) return explicit;
  if (explicit) return `${explicit}/api/elevenlabs/webhook`;
  return 'https://api.rtoshield.tech/api/elevenlabs/webhook';
}

export function agentRequestBody(webhookId: string | null): Record<string, unknown> {
  return {
    name: ELEVEN_AGENT_NAME,
    tags: ['rto-shield'],
    conversation_config: {
      agent: {
        language: 'hi',
        hinglish_mode: true,
        first_message:
          'Namaste, main {{shop_name}} se bol raha hoon. Aapka order {{order_id}}, {{amount}} rupaye. Kya aap confirm karte hain?',
        dynamic_variables: {
          dynamic_variable_placeholders: {
            shop_name: 'the shop',
            order_id: '1001',
            amount: '799',
            action: 'confirm',
            discount: '5',
            rto_order: 'order',
          },
        },
        prompt: { prompt: AGENT_PROMPT, llm: 'gemini-2.0-flash' },
      },
    },
    platform_settings: {
      data_collection: {
        outcome: {
          type: 'string',
          description: 'One of confirmed, cancelled, address, prepaid, no_response',
          enum: ['confirmed', 'cancelled', 'address', 'prepaid', 'no_response'],
        },
        landmark: { type: 'string', description: 'Landmark the buyer gave. Empty if none.' },
        address: { type: 'string', description: 'Updated address line if the buyer gave one. Empty if none.' },
      },
      ...(webhookId
        ? {
            workspace_overrides: {
              webhooks: {
                post_call_webhook_id: webhookId,
                events: ['transcript'],
                transcript_format: 'json',
                exclude_transcript: false,
              },
            },
          }
        : {}),
    },
  };
}

export async function syncElevenAgent(options: {
  apiKey: string;
  fetchImpl?: typeof fetch;
  knownAgentId?: string;
  webhookUrl?: string;
  registerWebhook?: boolean;
}): Promise<SyncResult> {
  if (!options.apiKey) throw new Error('missing-key');
  const fetchImpl = options.fetchImpl ?? fetch;
  let webhookId: string | null = null;
  let webhookSecret: string | null = null;
  if (options.registerWebhook && options.webhookUrl) {
    const hooked = await ensureWebhook(fetchImpl, options.apiKey, options.webhookUrl);
    webhookId = hooked.webhookId;
    webhookSecret = hooked.webhookSecret;
    await request(fetchImpl, options.apiKey, 'PATCH', '/convai/settings', {
      webhooks: {
        post_call_webhook_id: webhookId,
        events: ['transcript'],
        transcript_format: 'json',
        exclude_transcript: false,
      },
    });
  }

  const known = (options.knownAgentId || '').trim();
  if (known) {
    const patched = await request(fetchImpl, options.apiKey, 'PATCH', `/convai/agents/${encodeURIComponent(known)}`, agentRequestBody(webhookId));
    if (patched) return { agentId: known, created: false, webhookId, webhookSecret };
  }
  const found = await findAgent(fetchImpl, options.apiKey);
  if (found) {
    await request(fetchImpl, options.apiKey, 'PATCH', `/convai/agents/${encodeURIComponent(found)}`, agentRequestBody(webhookId));
    return { agentId: found, created: false, webhookId, webhookSecret };
  }
  const created = await request(fetchImpl, options.apiKey, 'POST', '/convai/agents/create', agentRequestBody(webhookId));
  if (!created) throw new Error('missing-agent-id');
  const agentId = String(created.agent_id || '');
  if (!agentId) throw new Error('missing-agent-id');
  return { agentId, created: true, webhookId, webhookSecret };
}

async function findAgent(fetchImpl: typeof fetch, apiKey: string): Promise<string> {
  const listed = await request(
    fetchImpl,
    apiKey,
    'GET',
    `/convai/agents?page_size=100&search=${encodeURIComponent(ELEVEN_AGENT_NAME)}`,
  );
  const agents = Array.isArray(listed?.agents) ? listed.agents : [];
  for (const agent of agents) {
    const row = agent as { agent_id?: string; name?: string };
    if (row.name === ELEVEN_AGENT_NAME && row.agent_id) return row.agent_id;
  }
  return '';
}

async function ensureWebhook(fetchImpl: typeof fetch, apiKey: string, webhookUrl: string): Promise<{ webhookId: string; webhookSecret: string | null }> {
  const listed = await request(fetchImpl, apiKey, 'GET', '/workspace/webhooks');
  const rows = webhookRows(listed);
  const existing = rows.find((row) => row.url === webhookUrl);
  if (existing) return { webhookId: existing.id, webhookSecret: null };
  const created = await request(fetchImpl, apiKey, 'POST', '/workspace/webhooks', {
    settings: { auth_type: 'hmac', name: 'RTO Shield post-call', webhook_url: webhookUrl },
  });
  if (!created) throw new Error('missing-webhook-id');
  const webhookId = String(created.webhook_id || '');
  if (!webhookId) throw new Error('missing-webhook-id');
  const secret = typeof created.webhook_secret === 'string' ? created.webhook_secret : null;
  return { webhookId, webhookSecret: secret };
}

function webhookRows(body: Record<string, unknown> | null): Array<{ id: string; url: string }> {
  if (!body) return [];
  const list = Array.isArray(body.webhooks) ? body.webhooks : Array.isArray(body) ? body : [];
  return list
    .map((item) => {
      const row = item as { webhook_id?: string; webhook_url?: string; settings?: { webhook_url?: string } };
      return { id: String(row.webhook_id || ''), url: String(row.webhook_url || row.settings?.webhook_url || '') };
    })
    .filter((row) => row.id && row.url);
}

async function request(
  fetchImpl: typeof fetch,
  apiKey: string,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  let response: Response;
  try {
    response = await fetchImpl(`${API}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error('elevenlabs-unreachable');
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`elevenlabs-${response.status}`);
  const text = await response.text();
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}
