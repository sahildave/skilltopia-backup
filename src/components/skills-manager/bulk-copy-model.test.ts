import { MOCK_INSTALLED_SCAN } from '@/platform/fixtures';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { describe, expect, it } from 'vitest';
import {
  buildBulkCopyDialogModel,
  bulkCopySourceSkillsForProvider,
} from './installed-skills-model';

function skill(name: string, providerIds: string[], paths: ScannedSkill['paths']): ScannedSkill {
  return {
    name,
    uninstallName: name,
    description: `${name} description`,
    scope: 'global',
    providerIds,
    origins: providerIds.map((providerId) => ({
      kind: 'providerDirectory' as const,
      providerId,
    })),
    paths,
  };
}

function pluginSkill(name: string, providerIds: string[]): ScannedSkill {
  return {
    ...skill(name, providerIds, []),
    origins: [
      { kind: 'claudePlugin' as const, plugin: 'demo-plugin', marketplace: 'demo', version: '1' },
    ],
  };
}

const CLAUDE_DIR = '/Users/mock/.claude/skills';
const CODEX_DIR = '/Users/mock/.codex/skills';
const UNIVERSAL_DIR = '/Users/mock/.agents/skills';

/**
 * Claude Code owns three real folders, carries one symlink projected in from
 * Universal, and can invoke one plugin-shipped skill. Codex owns one of the
 * same names, plus one of its own.
 */
function snapshot(): InstalledScanSnapshot {
  return {
    ...MOCK_INSTALLED_SCAN,
    universal: { skillsDir: UNIVERSAL_DIR, skillsDirExists: true, skillCount: 1 },
    providers: [
      {
        id: 'claude-code',
        name: 'Claude Code',
        universal: false,
        detected: true,
        skillsDir: CLAUDE_DIR,
        skillsDirExists: true,
        skillCount: 5,
      },
      {
        id: 'codex',
        name: 'Codex',
        universal: false,
        detected: true,
        skillsDir: CODEX_DIR,
        skillsDirExists: true,
        skillCount: 2,
      },
      {
        id: 'cline',
        name: 'Cline',
        universal: true,
        detected: true,
        // Shares the Universal tree, so never a source or destination.
        skillsDir: UNIVERSAL_DIR,
        skillsDirExists: true,
        skillCount: 1,
      },
    ],
    skills: [
      skill(
        'code-review',
        ['claude-code', 'codex'],
        [{ path: `${CLAUDE_DIR}/code-review` }, { path: `${CODEX_DIR}/code-review` }],
      ),
      skill('tdd', ['claude-code'], [{ path: `${CLAUDE_DIR}/tdd` }]),
      skill('implement', ['claude-code'], [{ path: `${CLAUDE_DIR}/implement` }]),
      skill(
        'frontend-design',
        ['claude-code', 'universal'],
        [
          { path: `${UNIVERSAL_DIR}/frontend-design` },
          // A projection into Claude Code, copyable via its resolved target.
          {
            path: `${CLAUDE_DIR}/frontend-design`,
            originalPath: `${UNIVERSAL_DIR}/frontend-design`,
          },
        ],
      ),
      pluginSkill('plugin-goodies', ['claude-code']),
      skill('codex-only', ['codex'], [{ path: `${CODEX_DIR}/codex-only` }]),
    ],
    warnings: [],
  };
}

describe('bulkCopySourceSkillsForProvider', () => {
  it('includes every invokable skill, symlinked projections included', () => {
    expect(
      bulkCopySourceSkillsForProvider(snapshot(), 'claude-code').copyable.map((s) => s.name),
    ).toEqual(['code-review', 'frontend-design', 'implement', 'tdd']);
  });

  it('holds plugin-managed skills out of the batch and names them', () => {
    const { copyable, pluginSkippedNames } = bulkCopySourceSkillsForProvider(
      snapshot(),
      'claude-code',
    );
    expect(copyable.map((s) => s.name)).not.toContain('plugin-goodies');
    expect(pluginSkippedNames).toEqual(['plugin-goodies']);
  });

  it('includes Universal skills for a universal-registry source with its own directory', () => {
    const base = snapshot();
    const universalCodex = {
      ...base,
      providers: base.providers.map((p) => (p.id === 'codex' ? { ...p, universal: true } : p)),
    };
    expect(
      bulkCopySourceSkillsForProvider(universalCodex, 'codex').copyable.map((s) => s.name),
    ).toContain('frontend-design');
  });

  it('returns nothing for a provider whose directory is the Universal tree', () => {
    expect(bulkCopySourceSkillsForProvider(snapshot(), 'cline').copyable).toEqual([]);
  });

  it('returns nothing for an unknown provider', () => {
    expect(bulkCopySourceSkillsForProvider(snapshot(), 'not-a-provider').copyable).toEqual([]);
  });
});

describe('buildBulkCopyDialogModel', () => {
  it('sources every invokable skill name and reports the plugin-skipped ones', () => {
    const model = buildBulkCopyDialogModel(snapshot(), 'claude-code');
    expect(model.skillNames).toEqual(['code-review', 'frontend-design', 'implement', 'tdd']);
    expect(model.pluginSkippedNames).toEqual(['plugin-goodies']);
  });

  it('splits each target into to-copy and already-there counts', () => {
    const model = buildBulkCopyDialogModel(snapshot(), 'claude-code');
    const codex = model.targets.find((target) => target.id === 'codex');
    expect(codex).toMatchObject({ name: 'Codex', toCopy: 3, alreadyThere: 1 });
  });

  it('never lists Universal or a Universal-directory-sharing provider as a destination', () => {
    const ids = buildBulkCopyDialogModel(snapshot(), 'claude-code').targets.map((t) => t.id);
    expect(ids).not.toContain('universal');
    expect(ids).not.toContain('cline');
  });

  it('never lists the source provider as its own destination', () => {
    const ids = buildBulkCopyDialogModel(snapshot(), 'claude-code').targets.map((t) => t.id);
    expect(ids).not.toContain('claude-code');
  });

  it('counts a link already pointing at the source as already there, like the backend', () => {
    // What a previous bulk copy leaves behind: Codex holds a symlink back to
    // Claude Code's bundle. The backend skips it, so the dialog must not
    // advertise it as still to copy.
    const base = snapshot();
    const model = buildBulkCopyDialogModel(
      {
        ...base,
        skills: base.skills.map((entry) =>
          entry.name === 'tdd'
            ? {
                ...entry,
                providerIds: [...entry.providerIds, 'codex'],
                paths: [
                  ...entry.paths,
                  { path: `${CODEX_DIR}/tdd`, originalPath: `${CLAUDE_DIR}/tdd` },
                ],
              }
            : entry,
        ),
      },
      'claude-code',
    );
    expect(model.targets.find((target) => target.id === 'codex')).toMatchObject({
      toCopy: 2,
      alreadyThere: 2,
    });
  });

  it('counts a link at the symlinked source’s resolved target as already there', () => {
    // frontend-design is a symlink in Claude Code's dir; the backend links
    // destinations to its resolved Universal bundle, so a destination link
    // already pointing there has nothing left to copy.
    const base = snapshot();
    const model = buildBulkCopyDialogModel(
      {
        ...base,
        skills: base.skills.map((entry) =>
          entry.name === 'frontend-design'
            ? {
                ...entry,
                paths: [
                  ...entry.paths,
                  {
                    path: `${CODEX_DIR}/frontend-design`,
                    originalPath: `${UNIVERSAL_DIR}/frontend-design`,
                  },
                ],
              }
            : entry,
        ),
      },
      'claude-code',
    );
    expect(model.targets.find((target) => target.id === 'codex')).toMatchObject({
      toCopy: 2,
      alreadyThere: 2,
    });
  });

  it('still counts a link pointing at another provider as to-copy, since the backend rewrites it', () => {
    const base = snapshot();
    const model = buildBulkCopyDialogModel(
      {
        ...base,
        skills: base.skills.map((entry) =>
          entry.name === 'tdd'
            ? {
                ...entry,
                paths: [
                  ...entry.paths,
                  { path: `${CODEX_DIR}/tdd`, originalPath: `${UNIVERSAL_DIR}/tdd` },
                ],
              }
            : entry,
        ),
      },
      'claude-code',
    );
    expect(model.targets.find((target) => target.id === 'codex')).toMatchObject({
      toCopy: 3,
      alreadyThere: 1,
    });
  });

  it('offers undetected registry providers as destinations with everything to copy', () => {
    const model = buildBulkCopyDialogModel(snapshot(), 'claude-code');
    const gemini = model.targets.find((target) => target.id === 'gemini-cli');
    expect(gemini).toMatchObject({ toCopy: 4, alreadyThere: 0 });
  });
});
