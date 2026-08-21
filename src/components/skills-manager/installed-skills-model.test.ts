import {
  MOCK_EMPTY_SCAN,
  MOCK_INSTALLED_SCAN,
  MOCK_PROVIDER_ONLY_SCAN,
  MOCK_UNIVERSAL_ONLY_SCAN,
} from '@/platform/fixtures';
import { PROJECT_AGENTS_PROVIDER_ID, UNIVERSAL_PROVIDER_ID } from '@/platform/types';
import { describe, expect, it } from 'vitest';
import {
  ALL_AGENTS_FILTER_ID,
  buildCopyProviderDialogModel,
  buildProviderSidebarModel,
  contentWarningsForSelection,
  filterSkillSectionsByQuery,
  filterSkillSectionsByView,
  filterSkillsForSelection,
  providerBadgesForSkill,
  warningRevealProviderId,
} from './installed-skills-model';

describe('filterSkillsForSelection', () => {
  it('returns all skills alphabetically for All Agents', () => {
    const { primary } = filterSkillsForSelection(MOCK_INSTALLED_SCAN, ALL_AGENTS_FILTER_ID);
    expect(primary.map((s) => s.name)).toEqual(['code-review', 'find-skills', 'frontend-design']);
  });

  it('returns only Universal-associated skills for Universal', () => {
    const { primary } = filterSkillsForSelection(MOCK_UNIVERSAL_ONLY_SCAN, UNIVERSAL_PROVIDER_ID);
    expect(primary.map((s) => s.name)).toEqual(['frontend-design']);
  });

  it('returns only direct provider skills for a non-Universal provider', () => {
    const { primary } = filterSkillsForSelection(MOCK_PROVIDER_ONLY_SCAN, 'claude-code');
    expect(primary.map((s) => s.name)).toEqual(['code-review']);
  });

  it('includes Universal skills for a universal-registry provider', () => {
    const snapshot: typeof MOCK_INSTALLED_SCAN = {
      ...MOCK_INSTALLED_SCAN,
      providers: [
        {
          id: 'codex',
          name: 'Codex',
          universal: true,
          detected: true,
          skillsDir: '/Users/mock/.codex/skills',
          skillsDirExists: true,
          skillCount: 1,
        },
      ],
      skills: [
        {
          name: 'baseline-ui',
          uninstallName: 'baseline-ui',
          description: 'Baseline UI skill',
          scope: 'global',
          providerIds: [UNIVERSAL_PROVIDER_ID],
          origins: [{ kind: 'providerDirectory' as const, providerId: UNIVERSAL_PROVIDER_ID }],
          paths: [{ path: '/Users/mock/.agents/skills/baseline-ui' }],
        },
        {
          name: 'hatch-pet',
          uninstallName: 'hatch-pet',
          description: 'Codex-local skill',
          scope: 'global',
          providerIds: ['codex'],
          origins: [{ kind: 'providerDirectory' as const, providerId: 'codex' }],
          paths: [{ path: '/Users/mock/.codex/skills/hatch-pet' }],
        },
        {
          name: 'apple-design',
          uninstallName: 'apple-design',
          description: 'Symlinked into Codex',
          scope: 'global',
          providerIds: ['codex'],
          origins: [{ kind: 'providerDirectory' as const, providerId: 'codex' }],
          paths: [
            {
              path: '/Users/mock/.codex/skills/apple-design',
              originalPath: '/Users/mock/.agents/skills/apple-design',
            },
          ],
        },
      ],
      universal: {
        skillsDir: '/Users/mock/.agents/skills',
        skillsDirExists: true,
        skillCount: 1,
      },
    };

    const { primary } = filterSkillsForSelection(snapshot, 'codex');
    expect(primary.map((s) => s.name)).toEqual(['apple-design', 'baseline-ui', 'hatch-pet']);

    const available = filterSkillSectionsByView({ primary }, snapshot, 'available').primary.map(
      (s) => s.name,
    );
    expect(available).toEqual(['apple-design', 'baseline-ui']);

    const providerOnly = filterSkillSectionsByView({ primary }, snapshot, 'provider').primary.map(
      (s) => s.name,
    );
    expect(providerOnly).toEqual(['hatch-pet']);
  });

  it('counts and lists plugin-delivered skills alongside directory skills', () => {
    const snapshot: typeof MOCK_INSTALLED_SCAN = {
      ...MOCK_INSTALLED_SCAN,
      skills: [
        ...MOCK_INSTALLED_SCAN.skills,
        {
          name: 'ponytail',
          uninstallName: 'ponytail',
          description: 'Laziest solution that works',
          scope: 'global',
          providerIds: [],
          origins: [
            { kind: 'claudePlugin', plugin: 'ponytail', marketplace: 'official', version: '1.2.0' },
          ],
          paths: [{ path: '/Users/mock/.claude/plugins/cache/ponytail/skills/ponytail' }],
        },
      ],
    };

    const { primary } = filterSkillsForSelection(snapshot, ALL_AGENTS_FILTER_ID);
    expect(primary.map((s) => s.name)).toContain('ponytail');
    expect(buildProviderSidebarModel(snapshot).allAgentsCount).toBe(4);
    expect(
      filterSkillSectionsByView({ primary }, snapshot, 'provider').primary.map((s) => s.name),
    ).toContain('ponytail');
  });

  it('keeps same-name skills as one card with merged provider tags', () => {
    const skill = MOCK_INSTALLED_SCAN.skills.find((s) => s.name === 'find-skills');
    expect(skill?.providerIds).toEqual([UNIVERSAL_PROVIDER_ID, 'claude-code']);
    expect(skill?.paths.length).toBe(2);
  });
});

describe('filterSkillSectionsByQuery', () => {
  it('returns sections unchanged when query is blank', () => {
    const sections = filterSkillsForSelection(MOCK_INSTALLED_SCAN, ALL_AGENTS_FILTER_ID);
    expect(filterSkillSectionsByQuery(sections, '   ')).toEqual(sections);
  });

  it('matches skill name case-insensitively', () => {
    const sections = filterSkillsForSelection(MOCK_INSTALLED_SCAN, ALL_AGENTS_FILTER_ID);
    const filtered = filterSkillSectionsByQuery(sections, 'FIND');
    expect(filtered.primary.map((s) => s.name)).toEqual(['find-skills']);
  });

  it('matches catalog repo source when provider', () => {
    const sections = filterSkillsForSelection(MOCK_INSTALLED_SCAN, ALL_AGENTS_FILTER_ID);
    const sources = new Map([
      ['find-skills', 'vercel-labs/agent-skills'],
      ['frontend-design', 'anthropics/skills'],
    ]);
    const filtered = filterSkillSectionsByQuery(sections, 'anthropics', sources);
    expect(filtered.primary.map((s) => s.name)).toEqual(['frontend-design']);
  });

  it('does not match description text', () => {
    const sections = filterSkillsForSelection(MOCK_INSTALLED_SCAN, ALL_AGENTS_FILTER_ID);
    const filtered = filterSkillSectionsByQuery(sections, 'frontend interfaces');
    expect(filtered.primary).toEqual([]);
  });
});

describe('filterSkillSectionsByView', () => {
  it('separates provider folders from Universal and symlinked skills', () => {
    const sections = filterSkillsForSelection(MOCK_INSTALLED_SCAN, ALL_AGENTS_FILTER_ID);
    expect(
      filterSkillSectionsByView(sections, MOCK_INSTALLED_SCAN, 'provider').primary.map(
        (s) => s.name,
      ),
    ).toEqual(['code-review', 'find-skills']);
    expect(
      filterSkillSectionsByView(sections, MOCK_INSTALLED_SCAN, 'available').primary.map(
        (s) => s.name,
      ),
    ).toEqual(['find-skills', 'frontend-design']);
  });

  it('keeps the current sections unchanged for All', () => {
    const sections = filterSkillsForSelection(MOCK_INSTALLED_SCAN, ALL_AGENTS_FILTER_ID);
    expect(filterSkillSectionsByView(sections, MOCK_INSTALLED_SCAN, 'all')).toEqual(sections);
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
      origins: [
        { kind: 'providerDirectory' as const, providerId: 'claude-code' },
        { kind: 'providerDirectory' as const, providerId: 'cursor' },
      ],
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
      origins: [
        { kind: 'providerDirectory' as const, providerId: UNIVERSAL_PROVIDER_ID },
        { kind: 'providerDirectory' as const, providerId: 'cline' },
        { kind: 'providerDirectory' as const, providerId: 'claude-code' },
      ],
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

  it('shows Project badge for project .agents skills, not Universal', () => {
    const skill = {
      name: 'local-skill',
      uninstallName: 'local-skill',
      description: 'Project skill',
      scope: 'project' as const,
      providerIds: [PROJECT_AGENTS_PROVIDER_ID],
      origins: [{ kind: 'providerDirectory' as const, providerId: PROJECT_AGENTS_PROVIDER_ID }],
      paths: [{ path: '/Users/mock/code/app/.agents/skills/local-skill' }],
    };
    const snapshot = {
      ...MOCK_INSTALLED_SCAN,
      skills: [skill],
      universal: {
        skillsDir: '/Users/mock/code/app/.agents/skills',
        skillsDirExists: true,
        skillCount: 1,
      },
      providers: [
        {
          id: 'cursor',
          name: 'Cursor',
          universal: true,
          detected: true,
          skillsDir: '/Users/mock/code/app/.agents/skills',
          skillsDirExists: true,
          skillCount: 1,
        },
        {
          id: 'claude-code',
          name: 'Claude Code',
          universal: false,
          detected: true,
          skillsDir: '/Users/mock/code/app/.claude/skills',
          skillsDirExists: true,
          skillCount: 0,
        },
      ],
    };
    expect(providerBadgesForSkill(skill, snapshot)).toEqual([{ kind: 'project' }]);
  });

  it('shows Project plus .claude location for project-local provider copies', () => {
    const skill = {
      name: 'local-skill',
      uninstallName: 'local-skill',
      description: 'Project skill',
      scope: 'project' as const,
      providerIds: [PROJECT_AGENTS_PROVIDER_ID, 'claude-code'],
      origins: [
        { kind: 'providerDirectory' as const, providerId: PROJECT_AGENTS_PROVIDER_ID },
        { kind: 'providerDirectory' as const, providerId: 'claude-code' },
      ],
      paths: [
        { path: '/Users/mock/code/app/.agents/skills/local-skill' },
        { path: '/Users/mock/code/app/.claude/skills/local-skill' },
      ],
    };
    const snapshot = {
      ...MOCK_INSTALLED_SCAN,
      skills: [skill],
      universal: {
        skillsDir: '/Users/mock/code/app/.agents/skills',
        skillsDirExists: true,
        skillCount: 1,
      },
      providers: [
        {
          id: 'cursor',
          name: 'Cursor',
          universal: true,
          detected: true,
          skillsDir: '/Users/mock/code/app/.agents/skills',
          skillsDirExists: true,
          skillCount: 1,
        },
        {
          id: 'claude-code',
          name: 'Claude Code',
          universal: false,
          detected: true,
          skillsDir: '/Users/mock/code/app/.claude/skills',
          skillsDirExists: true,
          skillCount: 1,
        },
      ],
    };
    expect(providerBadgesForSkill(skill, snapshot)).toEqual([
      { kind: 'project' },
      { kind: 'location', label: '.claude' },
    ]);
  });

  it('shows .claude location only for project skills outside .agents', () => {
    const skill = {
      name: 'claude-only',
      uninstallName: 'claude-only',
      description: 'Claude project skill',
      scope: 'project' as const,
      providerIds: ['claude-code'],
      origins: [{ kind: 'providerDirectory' as const, providerId: 'claude-code' }],
      paths: [{ path: '/Users/mock/code/app/.claude/skills/claude-only' }],
    };
    const snapshot = {
      ...MOCK_INSTALLED_SCAN,
      skills: [skill],
      universal: {
        skillsDir: '/Users/mock/code/app/.agents/skills',
        skillsDirExists: true,
        skillCount: 0,
      },
      providers: [
        {
          id: 'claude-code',
          name: 'Claude Code',
          universal: false,
          detected: true,
          skillsDir: '/Users/mock/code/app/.claude/skills',
          skillsDirExists: true,
          skillCount: 1,
        },
      ],
    };
    expect(providerBadgesForSkill(skill, snapshot)).toEqual([
      { kind: 'location', label: '.claude' },
    ]);
  });
});

describe('buildCopyProviderDialogModel', () => {
  it('groups available, installed, and other providers without Universal', () => {
    const skill = MOCK_INSTALLED_SCAN.skills.find((s) => s.name === 'find-skills');
    expect(skill).toBeDefined();
    if (!skill) return;

    const model = buildCopyProviderDialogModel(skill, MOCK_INSTALLED_SCAN);
    expect(model.available.map((p) => p.id)).toEqual(['cursor']);
    expect(model.installed.map((p) => p.id)).toEqual(['claude-code']);
    expect(model.installed.every((p) => p.id !== UNIVERSAL_PROVIDER_ID)).toBe(true);
    expect(model.other.some((p) => p.id === 'cursor')).toBe(false);
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
          origins: [{ kind: 'providerDirectory' as const, providerId: 'claude-code' }],
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
      origins: [
        { kind: 'providerDirectory' as const, providerId: UNIVERSAL_PROVIDER_ID },
        { kind: 'providerDirectory' as const, providerId: 'cline' },
        { kind: 'providerDirectory' as const, providerId: 'claude-code' },
      ],
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
    // Cursor is a detected universal agent that can invoke Universal skills, so it
    // lands in Available (active) rather than Other when the skill is not installed there.
    expect(model.available.some((p) => p.id === 'cursor')).toBe(true);
    expect(model.other.some((p) => p.id === 'cursor')).toBe(false);
  });
});

describe('buildProviderSidebarModel', () => {
  it('keeps Universal visible and lists filled providers in the active group', () => {
    const model = buildProviderSidebarModel(MOCK_INSTALLED_SCAN);
    expect(model.universal.skillCount).toBe(2);
    expect(model.universal.skillsDir).toBe('/Users/mock/.agents/skills');
    expect(model.allAgentsCount).toBe(3);
    // Cursor is universal:true with an empty own dir, but can invoke Universal skills.
    expect(model.activeProviders.map((p) => p.id)).toEqual(['claude-code', 'cursor']);
    expect(model.activeProviders.find((p) => p.id === 'cursor')?.skillCount).toBe(2);
    expect(model.inactiveProviders.some((p) => p.id === 'cursor')).toBe(false);
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
