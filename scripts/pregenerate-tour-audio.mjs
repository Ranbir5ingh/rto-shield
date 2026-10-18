/**
 * Fill the local narration cache. Optional. The API caches on first play.
 *
 *   ELEVENLABS_API_KEY=... node --experimental-strip-types scripts/pregenerate-tour-audio.mjs
 *
 * Writes mp3 files under var/tour-narration/. The key is never printed.
 */
import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NARRATION, TOUR_TTS_MODEL, TOUR_VOICE_ID } from '../apps/api/src/tours/narration-scripts.ts';

const key = process.env.ELEVENLABS_API_KEY || '';
if (!key) {
  console.error('Set ELEVENLABS_API_KEY in the environment. The key is not printed.');
  process.exit(1);
}

const dir = path.resolve('var/tour-narration');
await mkdir(dir, { recursive: true });
let written = 0;
for (const [stepId, text] of Object.entries(NARRATION)) {
  const hash = createHash('sha256').update(`${TOUR_VOICE_ID}|${TOUR_TTS_MODEL}|${text}`).digest('hex');
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
    console.error(`step ${stepId} status ${response.status}`);
    process.exit(1);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(path.join(dir, `${hash}.mp3`), bytes);
  written += 1;
  console.log(`${stepId} ${bytes.length} bytes`);
}
console.log(`cached ${written} lines in ${dir}`);
