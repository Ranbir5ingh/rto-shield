import { gemmaNotice, nextMlReachability } from './ml-status';

describe('ML banner reachability', () => {
  it('hides the banner on the first miss and shows it after a second miss', () => {
    const first = nextMlReachability(0, false);
    expect(first.publish).toBe(false);
    expect(first.failures).toBe(1);
    const second = nextMlReachability(first.failures, false);
    expect(second.publish).toBe(true);
    expect(second.failures).toBe(2);
  });

  it('shows the Gemma notice only when Gemma cannot answer', () => {
    expect(gemmaNotice({ reachable: true, gemini: true, ollama: false, gemmaReady: true })).toBe(false);
    expect(gemmaNotice({ reachable: true, gemini: true, ollama: false, gemmaReady: null })).toBe(false);
    expect(gemmaNotice({ reachable: true, gemini: true, ollama: false, gemmaReady: false })).toBe(true);
    expect(gemmaNotice({ reachable: true, gemini: false, ollama: false })).toBe(true);
    expect(gemmaNotice({ reachable: true, gemini: false, ollama: true, gemmaReady: false })).toBe(false);
    expect(gemmaNotice({ reachable: false, gemini: false, ollama: false, gemmaReady: false })).toBe(false);
    expect(gemmaNotice({ reachable: true, gemini: false, ollama: false, gemmaReady: false }, { sellerGemini: true })).toBe(false);
  });

  it('clears a confirmed outage as soon as a check succeeds', () => {
    const down = nextMlReachability(1, false);
    expect(down.publish).toBe(true);
    const back = nextMlReachability(down.failures, true);
    expect(back).toEqual({ failures: 0, publish: true, retryMs: 20_000 });
  });
});
