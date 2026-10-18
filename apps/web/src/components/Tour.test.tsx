import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
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
    narrationId: 'shopify-connect',
  },
  {
    id: 'import-alternatives',
    route: '/app/start',
    title: 'Other ways in',
    body: 'A CSV upload or the sample shop works if Shopify is not ready yet.',
    narrationId: 'import-alternatives',
  },
];

describe('product tour', () => {
  beforeEach(() => {
    HTMLMediaElement.prototype.play = () => Promise.resolve();
    HTMLMediaElement.prototype.pause = () => undefined;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null,
    })) as typeof window.matchMedia;
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

  it('keeps the card up while the page is loading, then moves on', async () => {
    const onFinish = vi.fn();
    render(
      <div data-tour-ready="false">
        <Tour steps={steps} onFinish={onFinish} stepTimeoutMs={40} />
      </div>,
    );
    expect(screen.getByRole('dialog').textContent).toContain('Connect Shopify');
    await waitFor(() => expect(screen.getByRole('dialog').textContent).toContain('Other ways in'));
    await waitFor(() => expect(onFinish).toHaveBeenCalledWith('done'));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('ends once when the anchor never appears, and Escape still closes it', async () => {
    const onFinish = vi.fn();
    const { unmount } = render(<Tour steps={[steps[0]!]} onFinish={onFinish} stepTimeoutMs={40} />);
    expect(screen.getByRole('dialog').textContent).toContain('Connect Shopify');
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    expect(onFinish).toHaveBeenCalledWith('done');
    unmount();

    const skip = vi.fn();
    render(<Tour steps={steps} onFinish={skip} stepTimeoutMs={5000} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(skip).toHaveBeenCalledWith('skip');
  });

  it('opens a closed menu before spotlighting what is inside', async () => {
    const onFinish = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" data-tour-open="more" aria-expanded={open} onClick={() => setOpen(true)}>
            More
          </button>
          {open ? <div data-tour="more-menu">Call and prepaid</div> : null}
          <Tour
            steps={[{
              id: 'more-menu',
              route: '/app/start',
              title: 'More actions',
              body: 'The menu is open.',
              narrationId: 'more-menu',
              reveal: ['more'],
            }]}
            onFinish={onFinish}
          />
        </div>
      );
    }
    render(<Harness />);
    expect(await screen.findByText('Call and prepaid')).toBeTruthy();
    expect(screen.getByRole('dialog').textContent).toContain('More actions');
  });
});