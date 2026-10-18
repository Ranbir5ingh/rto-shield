import { fireEvent, render, screen } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('stays inside the viewport and confirms only from the dialog', () => {
    const onConfirm = viConfirm();
    const onClose = viConfirm();
    render(
      <ConfirmDialog
        open
        title="Log out"
        body="You will need to sign in again."
        confirmLabel="Log out"
        onConfirm={onConfirm.fn}
        onClose={onClose.fn}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Log out' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.className).toContain('max-h-');
    expect(dialog.className).toContain('bg-paper');
    expect(dialog.parentElement?.className).toContain('items-end');
    expect(dialog.parentElement?.className).toContain('sm:items-center');
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(onConfirm.calls).toBe(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose.calls).toBe(1);
  });
});

function viConfirm() {
  const box = { calls: 0, fn: () => undefined as void };
  box.fn = () => {
    box.calls += 1;
  };
  return box;
}
