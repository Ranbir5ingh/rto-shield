import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertSafeVoiceScript } from '../common/messages';
import { traceSpan } from '../common/trace';

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(private readonly config: ConfigService) {}

  configured() {
    return Boolean(this.config.get<string>('ELEVENLABS_API_KEY'));
  }

  async synthesize(script: string, shop: string, amount: number) {
    const safe = assertSafeVoiceScript(script, shop, amount);
    const apiKey = this.config.get<string>('ELEVENLABS_API_KEY');
    if (!apiKey) {
      return {
        audioBase64: null as string | null,
        mime: null as string | null,
        script: safe,
        source: 'template',
        notice: 'Hindi voice needs ELEVENLABS_API_KEY. The script is ready to read aloud or paste into WhatsApp.',
      };
    }
    const voiceId = this.config.get<string>('ELEVENLABS_VOICE_ID') || 'EXAVITQu4vr4xnSDxMaL';
    const model = this.config.get<string>('ELEVENLABS_MODEL_ID') || 'eleven_multilingual_v2';
    try {
      const audio = await traceSpan(
        'tts elevenlabs.hindi',
        'gen_ai.tts',
        {
          'gen_ai.operation.name': 'tts',
          'gen_ai.system': 'elevenlabs',
          'gen_ai.request.model': model,
          'gen_ai.usage.input_tokens': safe.length,
          chars: safe.length,
        },
        async () => {
          const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
              'xi-api-key': apiKey,
              'content-type': 'application/json',
              accept: 'audio/mpeg',
            },
            body: JSON.stringify({ text: safe, model_id: model }),
            signal: AbortSignal.timeout(30_000),
          });
          if (!response.ok) {
            this.logger.warn(`ElevenLabs status ${response.status}`);
            return null;
          }
          const bytes = Buffer.from(await response.arrayBuffer());
          return bytes.toString('base64');
        },
      );
      if (!audio) {
        return {
          audioBase64: null,
          mime: null,
          script: safe,
          source: 'template',
          notice: 'ElevenLabs did not return audio. Check the API key. The script is still here.',
        };
      }
      return { audioBase64: audio, mime: 'audio/mpeg', script: safe, source: 'elevenlabs', notice: null };
    } catch (error) {
      this.logger.warn(`ElevenLabs failed: ${error instanceof Error ? error.name : 'error'}`);
      return {
        audioBase64: null,
        mime: null,
        script: safe,
        source: 'template',
        notice: 'Voice generation failed. The Hindi script is still available.',
      };
    }
  }
}
