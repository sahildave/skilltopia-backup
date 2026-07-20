import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_AGENTS_FILTER_ID } from '@/components/skills-manager/installed-skills-model';
import { useInstalledSkillsUiStore } from './installed-skills-ui-store';

describe('installed-skills-ui-store', () => {
  beforeEach(() => {
    useInstalledSkillsUiStore.setState({
      providerFilter: ALL_AGENTS_FILTER_ID,
      showAllUniversal: false,
    });
  });

  it('resets Show all Universal when the provider filter changes', () => {
    useInstalledSkillsUiStore.getState().setShowAllUniversal(true);
    expect(useInstalledSkillsUiStore.getState().showAllUniversal).toBe(true);

    useInstalledSkillsUiStore.getState().setProviderFilter('claude-code');
    expect(useInstalledSkillsUiStore.getState().providerFilter).toBe('claude-code');
    expect(useInstalledSkillsUiStore.getState().showAllUniversal).toBe(false);
  });

  it('resets Show all Universal explicitly when leaving Installed Skills', () => {
    useInstalledSkillsUiStore.setState({
      providerFilter: 'claude-code',
      showAllUniversal: true,
    });

    useInstalledSkillsUiStore.getState().resetShowAllUniversal();
    expect(useInstalledSkillsUiStore.getState().showAllUniversal).toBe(false);
    expect(useInstalledSkillsUiStore.getState().providerFilter).toBe('claude-code');
  });
});
