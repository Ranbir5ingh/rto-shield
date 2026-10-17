import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { maskedSecret, SecretField } from './SecretField';
import { ToastProvider, useToast } from './Toaster';

function Probe() {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.error('WhatsApp did not send')}>
      Fail
    </button>
  );
}

describe('toasts', () => {
  it('announces an error in the live region', () => {
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fail' }));
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('WhatsApp did not send');
    expect(alert.closest('[aria-live="polite"]')).toBeTruthy();
  });
});

describe('saved secrets', () => {
  it('masks a saved value with its last 4 characters', () => {
    expect(maskedSecret('a1B2')).toBe('••••••••a1B2');
    expect(maskedSecret('')).toBe('');
    render(
      <ToastProvider>
        <SecretField label="Permanent access token" field="whatsappToken" last4="a1B2" draft={null} onDraftChange={() => undefined} />
      </ToastProvider>,
    );
    expect(screen.getByDisplayValue('••••••••a1B2')).toBeTruthy();
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reveal' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(screen.queryByLabelText('RTO Shield password')).toBeNull();
  });

  it('asks for the password in a modal and returns focus when it closes', () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <SecretField label="Permanent access token" field="whatsappToken" last4="a1B2" draft={null} onDraftChange={() => undefined} />
        </ToastProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Reveal' }));
      const dialog = screen.getByRole('dialog', { name: 'Show the saved key' });
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(screen.getByLabelText('RTO Shield password')).toBeTruthy();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(dialog.parentElement?.className).toContain('secret-modal-out');
      act(() => {
        vi.advanceTimersByTime(450);
      });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reveal' }));
    } finally {
      vi.useRealTimers();
    }
  });
});
