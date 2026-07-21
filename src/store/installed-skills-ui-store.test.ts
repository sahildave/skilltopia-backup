import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_AGENTS_FILTER_ID } from '@/components/skills-manager/installed-skills-model';
import { useInstalledSkillsUiStore } from './installed-skills-ui-store';

describe('installed-skills-ui-store', () => {
  beforeEach(() => {
    useInstalledSkillsUiStore.setState({
      providerFilter: ALL_AGENTS_FILTER_ID,
      layoutMode: 'grid',
    });
  });

  it('updates layout mode without resetting other UI state', () => {
    useInstalledSkillsUiStore.setState({
      providerFilter: 'claude-code',
    });
    useInstalledSkillsUiStore.getState().setLayoutMode('list');
    expect(useInstalledSkillsUiStore.getState().layoutMode).toBe('list');
    expect(useInstalledSkillsUiStore.getState().providerFilter).toBe('claude-code');
  });

  it('updates the provider filter', () => {
    useInstalledSkillsUiStore.getState().setProviderFilter('claude-code');
    expect(useInstalledSkillsUiStore.getState().providerFilter).toBe('claude-code');
  });
});
