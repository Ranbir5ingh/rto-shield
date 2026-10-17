import { render, screen } from '@testing-library/react';
import { WakeScreen } from './WakeGate';

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
