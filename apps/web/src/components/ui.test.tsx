import { render, screen } from '@testing-library/react';
import { RiskBadge } from './ui';

describe('RiskBadge', () => {
  it('shows the band in text, not colour alone', () => {
    render(<RiskBadge band="High" />);
    expect(screen.getByText('High')).toBeTruthy();
  });
});
