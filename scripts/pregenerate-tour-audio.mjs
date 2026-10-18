/**
 * Fill the local narration cache. Optional. Production uses POST /api/tours/narration/warm.
 *
 *   ELEVENLABS_API_KEY=... node --experimental-strip-types scripts/pregenerate-tour-audio.mjs
 *
 * Writes mp3 files under var/tour-narration/. The key is never printed.
 */
import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NARRATION, TOUR_TTS_MODEL, TOUR_VOICE_ID, narrationJobs } from '../apps/api/src/tours/narration-scripts.ts';

const key = process.env.ELEVENLABS_API_KEY || '';
if (!key) {
  console.error('Set ELEVENLABS_API_KEY in the environment. The key is not printed.');
  process.exit(1);
}

const dir = path.resolve('var/tour-narration');
await mkdir(dir, { recursive: true });
let written = 0;
for (const job of narrationJobs()) {
  const text = NARRATION[job.id][job.lang];
  const hash = createHash('sha256').update(`${TOUR_VOICE_ID}|${TOUR_TTS_MODEL}|${job.lang}|${text}`).digest('hex');
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${TOUR_VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      'content-type': 'application/json',
      accept: 'audio/mpeg',
    },
    body: JSON.stringify({ text, model_id: TOUR_TTS_MODEL }),
  });
  if (!response.ok) {
    console.error(`step ${job.id} ${job.lang} status ${response.status}`);
    process.exit(1);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(path.join(dir, `${hash}.mp3`), bytes);
  written += 1;
  console.log(`${job.id} ${job.lang} ${bytes.length} bytes`);
}
console.log(`cached ${written} lines in ${dir}`);
