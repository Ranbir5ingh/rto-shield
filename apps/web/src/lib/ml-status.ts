/**
 * The wake loader already proved both servers answer before the shop opens.
 * One missed integrations check is a cold or busy moment, so the banner waits
 * for a second miss and clears on the next success.
 */
/** Yellow Gemma notice: only when notes cannot actually be written. */
export function gemmaNotice(ml: {
  reachable: boolean;
  gemini: boolean;
  ollama: boolean;
  gemmaReady?: boolean | null;
}): boolean {
  if (!ml.reachable || ml.ollama) return false;
  if (ml.gemmaReady === false) return true;
  // Older health payloads only know whether a key is set.
  return ml.gemmaReady == null && !ml.gemini;
}

export function nextMlReachability(failures: number, reachable: boolean): {
  failures: number;
  publish: boolean;
  retryMs: number;
} {
  if (reachable) return { failures: 0, publish: true, retryMs: 20_000 };
  const next = failures + 1;
  return { failures: next, publish: next >= 2, retryMs: 2_500 };
}
