import { act, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { WAKE_GRACE_MS, resetWakeSession } from '@/lib/wake';
import { WakeGate, WakeScreen } from './WakeGate';

const probe = vi.hoisted(() => ({
  wake: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/login',
}));

vi.mock('@/lib/wake', async () => {
  const actual = await vi.importActual<typeof import('@/lib/wake')>('@/lib/wake');
  return {
    ...actual,
    probeWake: (...args: unknown[]) => probe.wake(...args),
  };
});

describe('wake screen', () => {
  it('keeps the paper background and the heading on one overlay while it leaves', () => {
    const { container } = render(
      <WakeScreen
        message="Warming up the risk model..."
        elapsedLabel="0:04"
        progress={0.4}
        failed={false}
        apiUp
        mlUp={false}
        leaving
        onRetry={() => undefined}
      />,
    );
    const overlay = container.querySelector('.wake-overlay');
    expect(overlay?.className).toContain('wake-overlay-leave');
    expect(overlay?.contains(screen.getByRole('heading', { name: 'Getting the servers ready' }))).toBe(true);
    expect(screen.getByText('API')).toBeTruthy();
    expect(screen.getByText('Risk model')).toBeTruthy();
    expect(screen.getByText('Up')).toBeTruthy();
    expect(screen.getByText('Waking')).toBeTruthy();
  });
});

describe('wake gate', () => {
  beforeEach(() => {
    resetWakeSession();
    probe.wake.mockReset();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    vi.useRealTimers();
    resetWakeSession();
  });

  it('fades the same overlay node out and does not wake again in this page session', async () => {
    let release: (value: { api: boolean; ml: boolean }) => void = () => undefined;
    probe.wake.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    vi.useFakeTimers();
    const view = render(
      <WakeGate>
        <p>The page</p>
      </WakeGate>,
    );
    expect(view.container.querySelector('.wake-overlay')).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(WAKE_GRACE_MS);
    });
    const overlay = view.container.querySelector('.wake-overlay');
    expect(overlay?.className).toContain('wake-overlay-enter');
    expect(screen.queryByText('The page')).toBeNull();

    await act(async () => {
      release({ api: true, ml: true });
    });
    expect(view.container.querySelector('.wake-overlay')).toBe(overlay);
    expect(overlay?.className).toContain('wake-overlay-leave');
    expect(screen.getByText('The page')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(view.container.querySelector('.wake-overlay')).toBeNull();
    const calls = probe.wake.mock.calls.length;

    view.unmount();
    render(
      <WakeGate>
        <p>The page</p>
      </WakeGate>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(WAKE_GRACE_MS + 50);
    });
    expect(document.querySelector('.wake-overlay')).toBeNull();
    expect(probe.wake.mock.calls.length).toBe(calls);
  });
});
