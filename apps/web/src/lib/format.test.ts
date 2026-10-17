import { bandClass, engineLabel, inr, predictorLabel } from './format';

describe('format', () => {
  it('formats rupees and bands', () => {
    expect(inr(499)).toMatch(/499/);
    expect(bandClass('High')).toContain('high');
    expect(predictorLabel('sklearn-gradient-boosting')).toMatch(/scikit-learn/);
    expect(predictorLabel('tabpfn-client')).toBe('TabPFN');
    expect(engineLabel('gemini')).toBe('Gemini');
    expect(engineLabel('template')).toBe('Built-in template');
    expect(engineLabel('ollama')).toBe('Gemma on this server');
  });
});
