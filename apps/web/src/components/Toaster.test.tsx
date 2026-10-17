import { fireEvent, render, screen } from '@testing-library/react';
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
  });
});
