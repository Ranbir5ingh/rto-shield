import { agentRequestBody, syncElevenAgent } from './agent-sync';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('syncElevenAgent', () => {
  const key = 'xi-test-key-not-real';

  it('updates an agent it already knows and does not create another', async () => {
    const calls: string[] = [];
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method || 'GET'} ${url}`);
      expect(JSON.stringify(init?.headers || {})).not.toMatch(/logged/);
      if (String(url).includes('/convai/agents/agent-1') && init?.method === 'PATCH') return jsonResponse({ agent_id: 'agent-1' });
      return jsonResponse({}, 500);
    }) as unknown as typeof fetch;

    const result = await syncElevenAgent({ apiKey: key, fetchImpl, knownAgentId: 'agent-1' });
    expect(result).toEqual({ agentId: 'agent-1', created: false, webhookId: null, webhookSecret: null });
    expect(calls.some((call) => call.includes('/agents/create'))).toBe(false);
    expect(agentRequestBody(null).name).toBe('RTO Shield order desk');
  });

  it('creates an agent when the name is new, then reuses a webhook', async () => {
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method || 'GET';
      const target = String(url);
      if (method === 'GET' && target.includes('/workspace/webhooks')) {
        return jsonResponse({ webhooks: [{ webhook_id: 'wh-1', webhook_url: 'https://api.rtoshield.tech/api/elevenlabs/webhook' }] });
      }
      if (method === 'PATCH' && target.endsWith('/convai/settings')) return jsonResponse({ ok: true });
      if (method === 'GET' && target.includes('/convai/agents')) return jsonResponse({ agents: [] });
      if (method === 'POST' && target.includes('/agents/create')) return jsonResponse({ agent_id: 'agent-new' });
      return jsonResponse({}, 404);
    }) as unknown as typeof fetch;

    const result = await syncElevenAgent({
      apiKey: key,
      fetchImpl,
      webhookUrl: 'https://api.rtoshield.tech/api/elevenlabs/webhook',
      registerWebhook: true,
    });
    expect(result.agentId).toBe('agent-new');
    expect(result.created).toBe(true);
    expect(result.webhookId).toBe('wh-1');
    expect(result.webhookSecret).toBeNull();
  });

  it('refuses to run without a key and never puts the key in the error', async () => {
    await expect(syncElevenAgent({ apiKey: '' })).rejects.toThrow('missing-key');
  });
});
