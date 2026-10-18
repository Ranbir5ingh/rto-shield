import { callsMode, planCall } from './calls-mode';

describe('calls mode', () => {
  it('defaults to browser and ignores unknown values', () => {
    expect(callsMode({} as NodeJS.ProcessEnv)).toBe('browser');
    expect(callsMode({ CALLS_MODE: 'live' } as NodeJS.ProcessEnv)).toBe('live');
    expect(callsMode({ CALLS_MODE: 'simulated' } as NodeJS.ProcessEnv)).toBe('simulated');
    expect(callsMode({ CALLS_MODE: 'paid' } as NodeJS.ProcessEnv)).toBe('browser');
  });

  it('keeps the free path on a browser call and a simulated outbound', () => {
    const ready = { mode: 'browser' as const, allowPhone: true, hasKey: true, hasPhoneId: true };
    expect(planCall({ ...ready, prefer: 'browser' })).toEqual({ kind: 'browser', notice: null });
    expect(planCall({ ...ready, prefer: 'phone' }).kind).toBe('simulated');
    expect(planCall({ mode: 'simulated', prefer: 'browser', allowPhone: true, hasKey: true, hasPhoneId: true }).kind).toBe('simulated');
    expect(planCall({ mode: 'browser', prefer: 'browser', allowPhone: true, hasKey: false, hasPhoneId: false }).kind).toBe('simulated');
  });

  it('dials a real number only in live mode when the phone id is set', () => {
    const live = { mode: 'live' as const, prefer: 'phone' as const, allowPhone: true, hasKey: true, hasPhoneId: true };
    expect(planCall(live).kind).toBe('phone');
    expect(planCall({ ...live, hasPhoneId: false }).kind).toBe('simulated');
    expect(planCall({ ...live, allowPhone: false }).kind).toBe('simulated');
    expect(planCall({ ...live, prefer: 'browser' }).kind).toBe('browser');
  });
});
