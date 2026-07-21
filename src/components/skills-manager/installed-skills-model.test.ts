import { describe, expect, it } from 'vitest';
import {
  ALL_AGENTS_FILTER_ID,
  buildCopyProviderDialogModel,
  buildProviderSidebarModel,
  contentWarningsForSelection,
  filterSkillSectionsByQuery,
  filterSkillsForSelection,
  providerBadgesForSkill,
  warningRevealProviderId,
} from './installed-skills-model';
import {
  MOCK_EMPTY_SCAN,
  MOCK_INSTALLED_SCAN,
  MOCK_PROVIDER_ONLY_SCAN,
  MOCK_UNIVERSAL_ONLY_SCAN,
} from '@/platform/fixtures';
import { UNIVERSAL_PROVIDER_ID } from '@/platform/types';

describe('filterSkillsForSelection', () => {
  it('returns all skills alphabetically for All Agents', () => {
    const { primary, universalSection } = filterSkillsForSelection(
      MOCK_INSTALLED_SCAN,
      ALL_AGENTS_FILTER_ID,
      false,
    );
    expect(universalSection).toBeNull();
    expect(primary.map((s) => s.name)).toEqual(['code-review', 'find-skills', 'frontend-design']);
  });

  it('returns only Universal-associated skills for Universal', () => {
    const { primary } = filterSkillsForSelection(
      MOCK_UNIVERSAL_ONLY_SCAN,
      UNIVERSAL_PROVIDER_ID,
      false,
    );
    expect(primary.map((s) => s.name)).toEqual(['frontend-design']);
  });

  it('returns only direct provider skills for a non-Universal provider', () => {
    const { primary, universalSection } = filterSkillsForSelection(
      MOCK_PROVIDER_ONLY_SCAN,
      'claude-code',
      false,
    );
    expect(universalSection).toBeNull();
    expect(primary.map((s) => s.name)).toEqual(['code-review']);
  });

  it('keeps same-name skills as one card with merged provider tags', () => {
    const skill = MOCK_INSTALLED_SCAN.skills.find((s) => s.name === 'find-skills');
    expect(skill?.providerIds).toEqual([UNIVERSAL_PROVIDER_ID, 'claude-code']);
    expect(skill?.paths.length).toBe(2);
  });

  it('appends Universal skills not already listed when Show all Universal is on', () => {
    const { primary, universalSection } = filterSkillsForSelection(
      MOCK_INSTALLED_SCAN,
      'claude-code',
      true,
    );
    expect(primary.map((s) => s.name)).toEqual(['code-review', 'find-skills']);
    expect(universalSection?.map((s) => s.name)).toEqual(['frontend-design']);
  });
});

describe('filterSkillSectionsByQuery', () => {
  it('returns sections unchanged when query is blank', () => {
    const sections = filterSkillsForSelection(MOCK_INSTALLED_SCAN, ALL_AGENTS_FILTER_ID, false);
    expect(filterSkillSectionsByQuery(sections, '   ')).toEqual(sections);
  });

  it('matches skill name case-insensitively', () => {
    const sections = filterSkillsForSelection(MOCK_INSTALLED_SCAN, ALL_AGENTS_FILTER_ID, false);
    const filtered = filterSkillSectionsByQuery(sections, 'FIND');
    expect(filtered.primary.map((s) => s.name)).toEqual(['find-skills']);
    expect(filtered.universalSection).toBeNull();
  });

  it('matches catalog repo source when provided', () => {
    const sections = filterSkillsForSelection(MOCK_INSTALLED_SCAN, ALL_AGENTS_FILTER_ID, false);
    const sources = new Map([
      ['find-skills', 'vercel-labs/agent-skills'],
      ['frontend-design', 'anthropics/skills'],
    ]);
    const filtered = filterSkillSectionsByQuery(sections, 'anthropics', sources);
    expect(filtered.primary.map((s) => s.name)).toEqual(['frontend-design']);
  });

  it('does not match description text', () => {
    const sections = filterSkillsForSelection(MOCK_INSTALLED_SCAN, ALL_AGENTS_FILTER_ID, false);
    const filtered = filterSkillSectionsByQuery(sections, 'frontend interfaces');
    expect(filtered.primary).toEqual([]);
  });

  it('filters both primary and universal sections', () => {
    const sections = filterSkillsForSelection(MOCK_INSTALLED_SCAN, 'claude-code', true);
    const filtered = filterSkillSectionsByQuery(sections, 'design');
    expect(filtered.primary.map((s) => s.name)).toEqual([]);
    expect(filtered.universalSection?.map((s) => s.name)).toEqual(['frontend-design']);
  });
});

describe('providerBadgesForSkill', () => {
  it('shows Universal plus an aggregated providers badge', () => {
    const skill = MOCK_INSTALLED_SCAN.skills.find((s) => s.name === 'find-skills');
    expect(skill).toBeDefined();
    if (!skill) return;
    expect(providerBadgesForSkill(skill, MOCK_INSTALLED_SCAN)).toEqual([
      { kind: 'universal' },
      { kind: 'providers', count: 1, names: ['Claude Code'] },
    ]);
  });

  it('omits the providers badge when only Universal is associated', () => {
    const skill = MOCK_UNIVERSAL_ONLY_SCAN.skills[0];
    expect(skill).toBeDefined();
    if (!skill) return;
    expect(providerBadgesForSkill(skill, MOCK_UNIVERSAL_ONLY_SCAN)).toEqual([
      { kind: 'universal' },
    ]);
  });

  it('omits Universal and aggregates multiple distinct providers', () => {
    const skill = {
      name: 'multi',
      uninstallName: 'multi',
      description: 'Multi provider skill',
      scope: 'global' as const,
      providerIds: ['claude-code', 'cursor'],
      paths: [
        { path: '/Users/mock/.claude/skills/multi' },
        { path: '/Users/mock/.cursor/skills/multi' },
      ],
    };
    const snapshot = {
      ...MOCK_INSTALLED_SCAN,
      skills: [skill],
      providers: [
        {
          id: 'claude-code',
          name: 'Claude Code',
          universal: false,
          detected: true,
          skillsDir: '/Users/mock/.claude/skills',
          skillsDirExists: true,
          skillCount: 1,
        },
        {
          id: 'cursor',
          name: 'Cursor',
          universal: true,
          detected: true,
          skillsDir: '/Users/mock/.cursor/skills',
          skillsDirExists: true,
          skillCount: 1,
        },
      ],
    };
    expect(providerBadgesForSkill(skill, snapshot)).toEqual([
      { kind: 'providers', count: 2, names: ['Claude Code', 'Cursor'] },
    ]);
  });

  it('excludes providers that share the Universal skills directory from counts', () => {
    const skill = {
      name: 'shared',
      uninstallName: 'shared',
      description: 'Shared dir skill',
      scope: 'global' as const,
      providerIds: [UNIVERSAL_PROVIDER_ID, 'cline', 'claude-code'],
      paths: [
        { path: '/Users/mock/.agents/skills/shared' },
        { path: '/Users/mock/.agents/skills/shared' },
        { path: '/Users/mock/.claude/skills/shared' },
      ],
    };
    const snapshot = {
      ...MOCK_INSTALLED_SCAN,
      skills: [skill],
      providers: [
        {
          id: 'cline',
          name: 'Cline',
          universal: true,
          detected: true,
          skillsDir: '/Users/mock/.agents/skills',
          skillsDirExists: true,
          skillCount: 1,
        },
        {
          id: 'claude-code',
          name: 'Claude Code',
          universal: false,
          detected: true,
          skillsDir: '/Users/mock/.claude/skills',
          skillsDirExists: true,
          skillCount: 1,
        },
      ],
    };
    expect(providerBadgesForSkill(skill, snapshot)).toEqual([
      { kind: 'universal' },
      { kind: 'providers', count: 1, names: ['Claude Code'] },
    ]);
  });
});

describe('buildCopyProviderDialogModel', () => {
  it('groups available, installed, and other providers without Universal', () => {
    const skill = MOCK_INSTALLED_SCAN.skills.find((s) => s.name === 'find-skills');
    expect(skill).toBeDefined();
    if (!skill) return;

    const model = buildCopyProviderDialogModel(skill, MOCK_INSTALLED_SCAN);
    expect(model.available.map((p) => p.id)).toEqual([]);
    expect(model.installed.map((p) => p.id)).toEqual(['claude-code']);
    expect(model.installed.every((p) => p.id !== UNIVERSAL_PROVIDER_ID)).toBe(true);
    expect(model.other.some((p) => p.id === 'cursor')).toBe(true);
    expect(model.other.some((p) => p.id === UNIVERSAL_PROVIDER_ID)).toBe(false);
    expect(model.other.some((p) => p.id === 'claude-code')).toBe(false);
  });

  it('puts uninstalled active providers in Available', () => {
    const skill = MOCK_UNIVERSAL_ONLY_SCAN.skills[0];
    expect(skill).toBeDefined();
    if (!skill) return;

    const snapshot = {
      ...MOCK_UNIVERSAL_ONLY_SCAN,
      providers: [
        {
          id: 'claude-code',
          name: 'Claude Code',
          universal: false,
          detected: true,
          skillsDir: '/Users/mock/.claude/skills',
          skillsDirExists: true,
          skillCount: 1,
        },
      ],
      skills: [
        skill,
        {
          name: 'other-skill',
          uninstallName: 'other-skill',
          description: 'Other',
          scope: 'global' as const,
          providerIds: ['claude-code'],
          paths: [{ path: '/Users/mock/.claude/skills/other-skill' }],
        },
      ],
    };

    const model = buildCopyProviderDialogModel(skill, snapshot);
    expect(model.available.map((p) => p.id)).toEqual(['claude-code']);
    expect(model.installed).toEqual([]);
  });

  it('excludes Universal-directory-sharing providers from destinations', () => {
    const skill = MOCK_INSTALLED_SCAN.skills.find((s) => s.name === 'code-review');
    expect(skill).toBeDefined();
    if (!skill) return;

    const snapshot = {
      ...MOCK_INSTALLED_SCAN,
      providers: [
        ...MOCK_INSTALLED_SCAN.providers,
        {
          id: 'cline',
          name: 'Cline',
          universal: true,
          detected: true,
          skillsDir: '/Users/mock/.agents/skills',
          skillsDirExists: true,
          skillCount: 0,
        },
      ],
    };

    const model = buildCopyProviderDialogModel(skill, snapshot);
    expect(model.available.some((p) => p.id === 'cline')).toBe(false);
    expect(model.installed.some((p) => p.id === 'cline')).toBe(false);
    expect(model.other.some((p) => p.id === 'cline')).toBe(false);
  });

  it('lists Universal-directory agents under Already installed when associated', () => {
    const skill = {
      name: 'shared',
      uninstallName: 'shared',
      description: 'Shared',
      scope: 'global' as const,
      providerIds: [UNIVERSAL_PROVIDER_ID, 'cline', 'claude-code'],
      paths: [
        { path: '/Users/mock/.agents/skills/shared' },
        { path: '/Users/mock/.claude/skills/shared' },
      ],
    };
    const snapshot = {
      ...MOCK_INSTALLED_SCAN,
      skills: [skill],
      providers: [
        {
          id: 'cline',
          name: 'Cline',
          universal: true,
          detected: true,
          skillsDir: '/Users/mock/.agents/skills',
          skillsDirExists: true,
          skillCount: 1,
        },
        {
          id: 'claude-code',
          name: 'Claude Code',
          universal: false,
          detected: true,
          skillsDir: '/Users/mock/.claude/skills',
          skillsDirExists: true,
          skillCount: 1,
        },
      ],
    };

    const model = buildCopyProviderDialogModel(skill, snapshot);
    expect(model.installed.map((p) => p.id).sort()).toEqual(['claude-code', 'cline']);
    expect(model.available.some((p) => p.id === 'cline')).toBe(false);
    expect(model.other.some((p) => p.id === 'cline')).toBe(false);
  });

  it('excludes unscanned Universal-directory agents from Other providers', () => {
    const skill = MOCK_INSTALLED_SCAN.skills.find((s) => s.name === 'code-review');
    expect(skill).toBeDefined();
    if (!skill) return;

    const model = buildCopyProviderDialogModel(skill, MOCK_INSTALLED_SCAN);
    expect(model.other.some((p) => p.id === 'cline')).toBe(false);
    expect(model.other.some((p) => p.id === 'cursor')).toBe(true);
  });
});

describe('buildProviderSidebarModel', () => {
  it('keeps Universal visible and lists filled providers in the active group', () => {
    const model = buildProviderSidebarModel(MOCK_INSTALLED_SCAN);
    expect(model.universal.skillCount).toBe(2);
    expect(model.universal.skillsDir).toBe('/Users/mock/.agents/skills');
    expect(model.allAgentsCount).toBe(3);
    expect(model.activeProviders.map((p) => p.id)).toEqual(['claude-code']);
    expect(model.inactiveProviders.some((p) => p.id === 'cursor')).toBe(true);
    expect(model.inactiveProviders.length).toBeGreaterThan(0);
    expect(model.inactiveProviders.every((p) => !p.active)).toBe(true);
    expect(model.inactiveProviders.some((p) => p.id === 'claude-code')).toBe(false);
  });

  it('sorts active providers by skill count descending, then name', () => {
    const snapshot: typeof MOCK_INSTALLED_SCAN = {
      ...MOCK_INSTALLED_SCAN,
      providers: [
        {
          id: 'cursor',
          name: 'Cursor',
          universal: true,
          detected: true,
          skillsDir: '/Users/mock/.cursor/skills',
          skillsDirExists: true,
          skillCount: 1,
        },
        {
          id: 'claude-code',
          name: 'Claude Code',
          universal: false,
          detected: true,
          skillsDir: '/Users/mock/.claude/skills',
          skillsDirExists: true,
          skillCount: 3,
        },
        {
          id: 'amp',
          name: 'Amp',
          universal: false,
          detected: true,
          skillsDir: '/Users/mock/.config/amp/skills',
          skillsDirExists: true,
          skillCount: 3,
        },
      ],
    };
    const model = buildProviderSidebarModel(snapshot);
    expect(model.activeProviders.map((p) => p.id)).toEqual(['amp', 'claude-code', 'cursor']);
  });

  it('keeps Universal visible when the scan is empty', () => {
    const model = buildProviderSidebarModel(MOCK_EMPTY_SCAN);
    expect(model.universal.skillCount).toBe(0);
    expect(model.allAgentsCount).toBe(0);
    expect(model.universal.skillsDirExists).toBe(false);
  });

  it('hides providers that share the Universal skills directory', () => {
    const snapshot: typeof MOCK_INSTALLED_SCAN = {
      ...MOCK_INSTALLED_SCAN,
      providers: [
        {
          id: 'cline',
          name: 'Cline',
          universal: true,
          detected: true,
          skillsDir: '/Users/mock/.agents/skills',
          skillsDirExists: true,
          skillCount: 2,
        },
        {
          id: 'cursor',
          name: 'Cursor',
          universal: true,
          detected: true,
          skillsDir: '/Users/mock/.cursor/skills',
          skillsDirExists: true,
          skillCount: 1,
        },
        {
          id: 'claude-code',
          name: 'Claude Code',
          universal: false,
          detected: true,
          skillsDir: '/Users/mock/.claude/skills',
          skillsDirExists: true,
          skillCount: 2,
        },
      ],
    };
    const model = buildProviderSidebarModel(snapshot);
    expect(model.activeProviders.map((p) => p.id)).toEqual(['claude-code', 'cursor']);
    expect(model.activeProviders.some((p) => p.id === 'cline')).toBe(false);
    expect(model.inactiveProviders.some((p) => p.id === 'cline')).toBe(false);
  });
});

describe('contentWarningsForSelection', () => {
  it('omits benign provider_empty warnings from banners', () => {
    expect(contentWarningsForSelection(MOCK_INSTALLED_SCAN, 'cursor')).toHaveLength(0);
    expect(contentWarningsForSelection(MOCK_INSTALLED_SCAN, ALL_AGENTS_FILTER_ID)).toHaveLength(0);
    expect(contentWarningsForSelection(MOCK_INSTALLED_SCAN, 'claude-code')).toHaveLength(0);
  });

  it('surfaces missing-directory and empty-universal warnings for banners', () => {
    expect(contentWarningsForSelection(MOCK_EMPTY_SCAN, UNIVERSAL_PROVIDER_ID)).toHaveLength(1);
    expect(contentWarningsForSelection(MOCK_EMPTY_SCAN, ALL_AGENTS_FILTER_ID)).toHaveLength(2);
    expect(contentWarningsForSelection(MOCK_EMPTY_SCAN, 'claude-code')).toHaveLength(1);
  });

  it('maps banner warnings to reveal provider ids', () => {
    const universalWarning = MOCK_EMPTY_SCAN.warnings.find((w) => w.code === 'universal_empty');
    expect(universalWarning).toBeDefined();
    if (!universalWarning) return;
    expect(warningRevealProviderId(universalWarning)).toBe(UNIVERSAL_PROVIDER_ID);

    const missingDir = MOCK_EMPTY_SCAN.warnings.find((w) => w.code === 'skills_dir_missing');
    expect(missingDir).toBeDefined();
    if (!missingDir) return;
    expect(warningRevealProviderId(missingDir)).toBe('claude-code');
  });
});
