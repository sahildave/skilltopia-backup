import { render, screen } from '@/test/test-utils';
import { describe, expect, it } from 'vitest';
import { ProviderCheckboxRow } from './ProviderCheckboxRow';

const option = { id: 'claude', name: 'Claude Code' };

describe('ProviderCheckboxRow', () => {
  it('labels the checkbox with the provider name', () => {
    render(<ProviderCheckboxRow option={option} checked={false} />);

    expect(screen.getByRole('checkbox', { name: 'Claude Code' })).toBeInTheDocument();
    expect(screen.queryByText('12 skills')).not.toBeInTheDocument();
  });

  it('renders secondary text under the provider name when given', () => {
    render(<ProviderCheckboxRow option={option} checked={false} description="12 skills" />);

    expect(screen.getByRole('checkbox', { name: 'Claude Code' })).toBeInTheDocument();
    expect(screen.getByText('12 skills')).toBeInTheDocument();
  });
});
