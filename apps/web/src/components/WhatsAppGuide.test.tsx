import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { WhatsAppGuideBody, WhatsAppSetupGuide } from './WhatsAppGuide';

const secret = 'seller-only-verify-token';
const callback = 'https://api.rtoshield.tech/api/whatsapp/webhook';

const api = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  api,
  ApiError: class ApiError extends Error {
    status = 401;
  },
}));

describe('WhatsApp setup guide', () => {
  beforeEach(() => {
    api.mockReset();
  });

  it('keeps the verify token hidden until the owner confirms a password', async () => {
    api.mockResolvedValue({ value: secret });
    render(
      <WhatsAppSetupGuide
        callbackUrl={callback}
        canReveal
        progress={{ phoneNumberId: '123456789012', tokenLast4: 'a1B2' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Setup guide' }));
    const dialog = screen.getByRole('dialog', { name: 'Setup guide' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.queryByText(secret)).toBeNull();
    expect(screen.getByText(callback)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy callback URL' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reveal verify token' }));
    fireEvent.change(screen.getByLabelText('Account password'), { target: { value: 'supersecret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show verify token' }));
    await waitFor(() => expect(screen.getByText(secret)).toBeTruthy());
    expect(api).toHaveBeenCalledWith('/whatsapp/verify-token', {
      method: 'POST',
      body: JSON.stringify({ password: 'supersecret' }),
    });
    expect(screen.getByRole('button', { name: 'Copy verify token' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'public WhatsApp guide' }).getAttribute('href')).toBe('/guides/whatsapp');
    fireEvent.click(screen.getByRole('button', { name: 'Hide verify token' }));
    expect(screen.queryByText(secret)).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hides the verify token on the public guide', () => {
    render(<WhatsAppGuideBody mode="public" callbackUrl={callback} canReveal />);
    expect(screen.queryByText(secret)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reveal verify token' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy verify token' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy callback URL' })).toBeTruthy();
    expect(screen.getByText(callback)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Create an app' }).getAttribute('href')).toBe(
      'https://developers.facebook.com/apps/creation/',
    );
  });
});
