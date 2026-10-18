import { describe, expect, it } from 'vitest';
import { observedClientIp } from './proxy-client';

describe('observedClientIp', () => {
  it('keeps the browser hop and ignores the proxy hops behind it', () => {
    expect(observedClientIp('203.0.113.9, 76.76.21.21', '76.76.21.21')).toBe('203.0.113.9');
    expect(observedClientIp(null, '203.0.113.10')).toBe('203.0.113.10');
    expect(observedClientIp('  ', null)).toBe('');
  });
});
