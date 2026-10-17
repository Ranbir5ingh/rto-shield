import { fireEvent, render, screen } from '@testing-library/react';
import { WhatsAppGuideBody, WhatsAppSetupGuide } from './WhatsAppGuide';

const secret = 'seller-only-verify-token';

describe('WhatsApp setup guide', () => {
  it('opens an accessible drawer and shows the verify token only there', () => {
    render(
      <WhatsAppSetupGuide
        callbackUrl="https://www.rtoshield.tech/api/whatsapp/webhook"
        verifyToken={secret}
        progress={{ phoneNumberId: '123456789012', tokenLast4: 'a1B2' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Setup guide' }));
    const dialog = screen.getByRole('dialog', { name: 'Setup guide' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText(secret)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy verify token' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy callback URL' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'public WhatsApp guide' }).getAttribute('href')).toBe('/guides/whatsapp');
    expect(screen.getAllByText('Done').length).toBeGreaterThan(0);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hides the verify token on the public guide', () => {
    render(<WhatsAppGuideBody mode="public" callbackUrl="https://www.rtoshield.tech/api/whatsapp/webhook" verifyToken={secret} />);
    expect(screen.queryByText(secret)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy verify token' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy callback URL' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Create an app' }).getAttribute('href')).toBe(
      'https://developers.facebook.com/apps/creation/',
    );
  });
});
