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
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = () => ({
      x: 40,
      y: 80,
      top: 80,
      left: 40,
      width: 160,
      height: 48,
      bottom: 128,
      right: 200,
      toJSON() {
        return {};
      },
    });
    Element.prototype.scrollIntoView = () => undefined;
  });

  it('waits for the target, then moves with Next, Back, and Escape', async () => {
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

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Connect Shopify');
    expect(dialog.textContent).toContain('One click. Enter your store domain');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.querySelector('[data-tour-overlay]')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect((await screen.findByRole('dialog')).textContent).toContain('Other ways in');

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect((await screen.findByRole('dialog')).textContent).toContain('One click. Enter your store domain');

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect((await screen.findByRole('dialog')).textContent).toContain('CSV upload');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onFinish).toHaveBeenCalledWith('skip');
  });

  it('does not open the card while the page is still loading its target', () => {
    render(
      <div data-tour-ready="false">
        <Tour steps={steps} onFinish={vi.fn()} />
      </div>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});