import { integrationDevNotices } from './integrations.controller';

const quiet = {
  encryption: 'configured',
  mongodb: 'configured',
  ml: { reachable: true, activePredictor: 'tabpfn', gemini: true, gemmaReady: true, ollama: false },
};

describe('integration dev notices', () => {
  it('names the setup gaps the yellow bar used to show', () => {
    expect(integrationDevNotices(quiet)).toEqual([]);
    expect(
      integrationDevNotices({
        encryption: 'development-fallback',
        mongodb: 'memory',
        ml: { reachable: true, activePredictor: 'sklearn-fallback', gemini: false, gemmaReady: null, ollama: false },
      }),
    ).toEqual([
      'Encryption key is unset. Set ENCRYPTION_KEY before real buyer data.',
      'Orders are in memory and disappear on restart.',
      'Scores use the scikit-learn fallback until TABPFN_TOKEN is set.',
      'Address notes and drafts use local templates until the platform Gemini key is set.',
    ]);
  });
});
