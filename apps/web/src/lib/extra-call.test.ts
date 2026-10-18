import { autopilotAttempts, autopilotCallLine, demoCallBudgetLine, extraCallResult, outcomeAfter } from './extra-call';

describe('extra call copy', () => {
  it('counts autopilot attempts and ignores the finished line', () => {
    const order = {
      callState: 'held' as const,
      timeline: [
        { step: 'call', detail: 'Outbound call placed' },
        { step: 'call', detail: 'Call finished: no_response' },
        { step: 'call', detail: 'Simulated call. The buyer was not dialed.' },
        { step: 'extra_call', detail: 'Simulated call. The buyer was not dialed.' },
      ],
    };
    expect(autopilotAttempts(order)).toBe(2);
    expect(autopilotCallLine(order)).toBe('Autopilot called 2 times, no answer');
  });

  it('uses the singular and says when autopilot has not called', () => {
    expect(autopilotCallLine({ timeline: [{ step: 'call', detail: 'Outbound call placed' }], callState: 'called' })).toBe('Autopilot called 1 time.');
    expect(autopilotCallLine({ timeline: [], callState: 'idle' })).toBe('Autopilot has not called.');
    expect(autopilotAttempts({ timeline: [], callState: 'held' })).toBe(1);
  });

  it('shows how many demo calls are left and when the window resets', () => {
    expect(demoCallBudgetLine({ remaining: 2, cap: 2, resetsAt: null })).toBe('2 demo calls left this half hour.');
    expect(demoCallBudgetLine({ remaining: 0, cap: 2, resetsAt: null })).toBe('No demo calls left this half hour.');
    const line = demoCallBudgetLine({ remaining: 1, cap: 2, resetsAt: '2026-10-18T13:15:00.000Z' });
    expect(line.startsWith('1 demo call left. Resets at ')).toBe(true);
    expect(line.endsWith('.')).toBe(true);
  });

  it('maps the inline result and reads a demo call that landed after the panel opened', () => {
    expect(extraCallResult('simulated')).toMatchObject({ label: 'Simulated call', answered: false });
    expect(extraCallResult('address')).toMatchObject({ label: 'Address changed', answered: true });
    expect(extraCallResult('confirmed')?.label).toBe('Confirmed');
    expect(extraCallResult('cancelled')?.label).toBe('Cancelled');
    expect(extraCallResult('no_answer')?.label).toBe('No answer');
    const order = {
      timeline: [
        { step: 'call', detail: 'Simulated call. The buyer was not dialed.' },
        { step: 'call', detail: 'Call finished: confirmed' },
      ],
    };
    expect(outcomeAfter(order, 1)?.label).toBe('Confirmed');
    expect(outcomeAfter(order, 0)?.label).toBe('Confirmed');
  });
});