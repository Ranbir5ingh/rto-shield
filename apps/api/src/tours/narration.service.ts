import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { GridFSBucket, type Db } from 'mongodb';
import { Connection, Model } from 'mongoose';
import { tmpdir } from 'os';
import path from 'path';
import { TourNarration } from '../database/tour-narration.schema';
import { TOUR_TTS_MODEL, TOUR_VOICE_ID, narrationFor, narrationJobs } from './narration-scripts';

@Injectable()
export class NarrationService implements OnModuleInit {
  private readonly logger = new Logger(NarrationService.name);
  private readonly memory = new Map<string, Buffer>();
  private readonly dir = path.join(tmpdir(), 'rto-tour-narration');

  constructor(
    private readonly config: ConfigService,
    @InjectModel(TourNarration.name) private readonly cache: Model<TourNarration>,
    @Optional() @InjectConnection() private readonly connection?: Connection,
  ) {}

  onModuleInit() {
    const key = this.config.get<string>('ELEVENLABS_API_KEY') || '';
    if (!key) return;
    void this.warm()
      .then((counts) => {
        this.logger.log(`Tour narration warm ready=${counts.ready} synthesized=${counts.synthesized} missing=${counts.missing}`);
      })
      .catch(() => undefined);
  }

  etag(stepId: string, lang = 'english'): string | null {
    const text = narrationFor(stepId, lang);
    if (!text) return null;
    return `"${this.hash(lang, text)}"`;
  }

  async audio(stepId: string, lang = 'english'): Promise<Buffer | null> {
    const text = narrationFor(stepId, lang);
    if (!text) return null;
    const hash = this.hash(lang, text);
    const cached = await this.peek(hash);
    if (cached) return cached;
    return this.synthesize(hash, text);
  }

  async warm(): Promise<{ ready: number; synthesized: number; missing: number }> {
    let ready = 0;
    let synthesized = 0;
    let missing = 0;
    for (const job of narrationJobs()) {
      const text = narrationFor(job.id, job.lang);
      if (!text) {
        missing += 1;
        continue;
      }
      const hash = this.hash(job.lang, text);
      if (await this.peek(hash)) {
        ready += 1;
        continue;
      }
      const audio = await this.synthesize(hash, text);
      if (audio) synthesized += 1;
      else missing += 1;
    }
    return { ready, synthesized, missing };
  }

  private hash(lang: string, text: string) {
    return createHash('sha256').update(`${TOUR_VOICE_ID}|${TOUR_TTS_MODEL}|${lang}|${text}`).digest('hex');
  }

  private bucket() {
    const db = this.connection?.db;
    if (!db) return null;
    // Mongoose ships its own mongodb types. The bucket API matches this process's driver.
    return new GridFSBucket(db as unknown as Db, { bucketName: 'tour_narration' });
  }

  private async peek(hash: string): Promise<Buffer | null> {
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

    const grid = await this.readGrid(hash);
    if (grid) {
      this.memory.set(hash, grid);
      await this.writeDisk(file, grid);
      return grid;
    }

    try {
      const row = await this.cache.findOne({ hash }).lean<{ audio?: Buffer }>();
      const stored = row?.audio ? Buffer.from(row.audio) : null;
      if (stored?.length) {
        this.memory.set(hash, stored);
        await this.writeDisk(file, stored);
        await this.writeGrid(hash, stored);
        return stored;
      }
    } catch {
      /* a database miss still allows a live synthesis */
    }
    return null;
  }

  private async synthesize(hash: string, text: string): Promise<Buffer | null> {
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
    await this.writeDisk(path.join(this.dir, `${hash}.mp3`), audio);
    await this.writeGrid(hash, audio);
    try {
      await this.cache.updateOne({ hash }, { $set: { hash, audio, mime: 'audio/mpeg' } }, { upsert: true });
    } catch {
      /* disk, GridFS, and memory still serve this process */
    }
    return audio;
  }

  private async readGrid(hash: string): Promise<Buffer | null> {
    const bucket = this.bucket();
    if (!bucket) return null;
    try {
      const files = await bucket.find({ filename: hash }).limit(1).toArray();
      if (!files.length) return null;
      const chunks: Buffer[] = [];
      const stream = bucket.openDownloadStreamByName(hash);
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      const audio = Buffer.concat(chunks);
      return audio.length ? audio : null;
    } catch {
      return null;
    }
  }

  private async writeGrid(hash: string, audio: Buffer) {
    const bucket = this.bucket();
    if (!bucket) return;
    try {
      const existing = await bucket.find({ filename: hash }).limit(1).toArray();
      if (existing.length) return;
      await new Promise<void>((resolve, reject) => {
        const stream = bucket.openUploadStream(hash, { contentType: 'audio/mpeg' });
        stream.on('error', reject);
        stream.on('finish', () => resolve());
        stream.end(audio);
      });
    } catch {
      /* memory and mongoose still serve */
    }
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
