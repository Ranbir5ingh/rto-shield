import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { Model } from 'mongoose';
import { tmpdir } from 'os';
import path from 'path';
import { TourNarration } from '../database/tour-narration.schema';
import { NARRATION, TOUR_TTS_MODEL, TOUR_VOICE_ID, narrationFor } from './narration-scripts';

@Injectable()
export class NarrationService {
  private readonly logger = new Logger(NarrationService.name);
  private readonly memory = new Map<string, Buffer>();
  private readonly dir = path.join(tmpdir(), 'rto-tour-narration');

  constructor(
    private readonly config: ConfigService,
    @InjectModel(TourNarration.name) private readonly cache: Model<TourNarration>,
  ) {}

  async audio(stepId: string): Promise<Buffer | null> {
    const text = narrationFor(stepId);
    if (!text) return null;
    const hash = createHash('sha256').update(`${TOUR_VOICE_ID}|${TOUR_TTS_MODEL}|${text}`).digest('hex');
    const remembered = this.memory.get(hash);
    if (remembered) return remembered;

    const file = path.join(this.dir, `${hash}.mp3`);
    try {
      const disk = await readFile(file);
      if (disk.length) {
        this.memory.set(hash, disk);
        return disk;
      }
    } catch {
      /* not on disk yet */
    }

    try {
      const row = await this.cache.findOne({ hash }).lean<{ audio?: Buffer }>();
      const stored = row?.audio ? Buffer.from(row.audio) : null;
      if (stored?.length) {
        this.memory.set(hash, stored);
        await this.writeDisk(file, stored);
        return stored;
      }
    } catch {
      /* a database miss still allows a live synthesis */
    }

    const key = this.config.get<string>('ELEVENLABS_API_KEY') || '';
    if (!key) return null;
    let response: Response;
    try {
      response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${TOUR_VOICE_ID}`, {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          'content-type': 'application/json',
          accept: 'audio/mpeg',
        },
        body: JSON.stringify({ text, model_id: TOUR_TTS_MODEL }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      this.logger.warn(`Tour narration failed: ${error instanceof Error ? error.name : 'error'}`);
      return null;
    }
    if (!response.ok) {
      this.logger.warn(`Tour narration status ${response.status}`);
      return null;
    }
    const audio = Buffer.from(await response.arrayBuffer());
    if (!audio.length) return null;
    this.memory.set(hash, audio);
    await this.writeDisk(file, audio);
    try {
      await this.cache.updateOne({ hash }, { $set: { hash, audio, mime: 'audio/mpeg' } }, { upsert: true });
    } catch {
      /* disk and memory still serve this process */
    }
    return audio;
  }

  private async writeDisk(file: string, audio: Buffer) {
    try {
      await mkdir(this.dir, { recursive: true });
      await writeFile(file, audio);
    } catch {
      /* the response is still returned */
    }
  }
}

export const narrationStepIds = Object.keys(NARRATION);
