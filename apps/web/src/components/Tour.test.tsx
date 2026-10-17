import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { TourStep } from '@/lib/tours';
import { Tour } from './Tour';

const push = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/start',
  useRouter: () => ({ push }),
}));

const steps: TourStep[] = [
  {
    id: 'shopify-connect',
    route: '/app/start',
    title: 'Connect Shopify',
    body: 'One click. Enter your store domain and Shopify sends the orders.',
  },
  {
    id: 'import-alternatives',
    route: '/app/start',
    title: 'Other ways in',
    body: 'A CSV upload or the sample shop works if Shopify is not ready yet.',
  },
];

describe('product tour', () => {
  it('spotlights the target, moves with Next and Back, and skips from the keyboard', () => {
    const onFinish = vi.fn();
    render(
      <div>
        <button type="button" data-tour="shopify-connect">
          Connect Shopify
        </button>
        <div data-tour="import-alternatives">CSV or sample</div>
        <Tour steps={steps} onFinish={onFinish} />
      </div>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Connect Shopify');
    expect(dialog.textContent).toContain('One click. Enter your store domain');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.querySelector('[data-tour-overlay]')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog').textContent).toContain('Other ways in');

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog').textContent).toContain('One click. Enter your store domain');

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog').textContent).toContain('CSV upload');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onFinish).toHaveBeenCalledWith('skip');
  });
});
