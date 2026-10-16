import { bandClass, inr, predictorLabel } from './format';

describe('format', () => {
  it('formats rupees and bands', () => {
    expect(inr(499)).toMatch(/499/);
    expect(bandClass('High')).toContain('high');
    expect(predictorLabel('sklearn-gradient-boosting')).toMatch(/scikit-learn/);
    expect(predictorLabel('tabpfn-client')).toBe('TabPFN');
  });
});
