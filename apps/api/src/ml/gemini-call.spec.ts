import { geminiCallFor } from './gemini-call';

describe('geminiCallFor', () => {
  it('never sends a seller key and leaves Gemini on the platform env', () => {
    expect(geminiCallFor()).toBeUndefined();
  });
});