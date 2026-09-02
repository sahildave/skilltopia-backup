import { render, screen } from '@/test/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { GeneralPane } from './GeneralPane';
import { useUpdateStore } from '@/platform/updates';
import type { UpdateState } from '@/platform/updates';

function renderWithUpdateState(state: UpdateState) {
  useUpdateStore.setState({ state });
  render(<GeneralPane />);
}

describe('GeneralPane update indicator', () => {
  beforeEach(() => {
    useUpdateStore.setState({ state: { status: 'idle' }, dialogOpen: false, controller: null });
  });

  it('reports an automatic check that failed', () => {
    renderWithUpdateState({
      status: 'failed',
      error: { code: 'network', message: 'offline' },
      reason: 'startup',
    });

    const indicator = screen.getByRole('status');
    expect(indicator).toHaveTextContent('Update failed');
    expect(indicator).toHaveTextContent(/Couldn’t reach the update server/);
  });

  it('stays hidden when nothing failed', () => {
    renderWithUpdateState({ status: 'upToDate', checkedAt: 0 });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('leaves a failed manual check to the update dialog', () => {
    renderWithUpdateState({
      status: 'failed',
      error: { code: 'network', message: 'offline' },
      reason: 'manual',
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
