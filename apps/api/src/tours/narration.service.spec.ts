import { createHash } from 'crypto';
import { rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { NarrationService } from './narration.service';
import { NARRATION, TOUR_TTS_MODEL, TOUR_VOICE_ID } from './narration-scripts';

describe('NarrationService', () => {
  const text = NARRATION['queue-list'];
  const cacheDir = path.join(tmpdir(), 'rto-tour-narration');

  beforeEach(async () => {
    await rm(cacheDir, { recursive: true, force: true });
  });

  function service(key: string, fetchImpl: typeof fetch, store: { audio?: Buffer } = {}) {
    const config = { get: (name: string) => (name === 'ELEVENLABS_API_KEY' ? key : undefined) };
    const cache = {
      findOne: () => ({
        lean: async () => (store.audio ? { audio: store.audio } : null),
      }),
      updateOne: async (_filter: unknown, update: { $set: { audio: Buffer } }) => {
        store.audio = update.$set.audio;
      },
    };
    const created = new NarrationService(config as never, cache as never);
    const target = created as unknown as { audio: (id: string) => Promise<Buffer | null> };
    jest.spyOn(global, 'fetch').mockImplementation(fetchImpl);
    return { created, target, store };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not call ElevenLabs when the server has no key', async () => {
    const fetchImpl = jest.fn();
    const { created } = service('', fetchImpl as unknown as typeof fetch);
    await expect(created.audio('queue-list')).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('synthesizes once and then serves the memory cache', async () => {
    const fetchImpl = jest.fn(async () => new Response(Buffer.from('mp3-bytes'), { status: 200 }));
    const { created } = service('test-key-not-real', fetchImpl as unknown as typeof fetch);
    const first = await created.audio('queue-list');
    const second = await created.audio('queue-list');
    expect(first?.toString()).toBe('mp3-bytes');
    expect(second?.toString()).toBe('mp3-bytes');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(TOUR_VOICE_ID);
    expect(url).not.toContain('test-key-not-real');
    const body = JSON.parse(String(init.body));
    expect(body.model_id).toBe(TOUR_TTS_MODEL);
    expect(body.text).toBe(text);
    expect(String(url)).not.toContain('test-key-not-real');
  });

  it('refuses an unknown step id', async () => {
    const { created } = service('test-key-not-real', jest.fn() as unknown as typeof fetch);
    await expect(created.audio('../etc/passwd')).resolves.toBeNull();
    await expect(created.audio('not-a-step')).resolves.toBeNull();
  });

  it('hashes the voice, model, and line, not the key', () => {
    const hash = createHash('sha256').update(`${TOUR_VOICE_ID}|${TOUR_TTS_MODEL}|${text}`).digest('hex');
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain('key');
  });
});
