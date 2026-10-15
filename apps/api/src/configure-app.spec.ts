import { webOrigins } from './configure-app';

describe('webOrigins', () => {
  it('accepts a comma-separated list, including a Vercel origin', () => {
    expect(webOrigins('https://rto-shield.vercel.app, http://localhost:3000')).toEqual([
      'https://rto-shield.vercel.app',
      'http://localhost:3000',
    ]);
  });

  it('falls back to localhost when unset', () => {
    expect(webOrigins(undefined)).toEqual(['http://localhost:3000']);
    expect(webOrigins('  ')).toEqual(['http://localhost:3000']);
  });
});
