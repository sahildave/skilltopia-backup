import { MOCK_EMPTY_SCAN } from '@/platform/fixtures';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { describe, expect, it } from 'vitest';
import { filterProjectSkillRows, projectSkillRows } from './project-skills-model';

function skill(name: string, description = `${name} description`): ScannedSkill {
  return {
    name,
    uninstallName: name,
    description,
    scope: 'project',
    providerIds: ['claude-code'],
    origins: [{ providerDirectory: { providerId: 'claude-code' } }],
    paths: [{ path: `/skills/${name}` }],
  };
}

function snapshotOf(...skills: ScannedSkill[]): InstalledScanSnapshot {
  return { ...MOCK_EMPTY_SCAN, skills };
}

const project = snapshotOf(skill('shared'), skill('project-only'));
const global = snapshotOf(skill('shared'), skill('universal-only'));

describe('projectSkillRows', () => {
  it('merges both scans and marks where each skill lives', () => {
    const rows = projectSkillRows(project, global, 'all');

    expect(rows.map((row) => [row.skill.name, row.origin])).toEqual([
      ['project-only', 'project'],
      ['shared', 'both'],
      ['universal-only', 'universal'],
    ]);
  });

  it('keeps the project copy of a shadowed skill, with its own snapshot', () => {
    const shared = projectSkillRows(project, global, 'all').find(
      (row) => row.skill.name === 'shared',
    );

    expect(shared?.snapshot).toBe(project);
  });

  it('scopes each tab to one scan', () => {
    expect(projectSkillRows(project, global, 'project').map((row) => row.skill.name)).toEqual([
      'shared',
      'project-only',
    ]);
    expect(projectSkillRows(project, global, 'universal').map((row) => row.skill.name)).toEqual([
      'shared',
      'universal-only',
    ]);
  });

  it('tolerates a missing scan', () => {
    expect(projectSkillRows(null, global, 'all').map((row) => row.origin)).toEqual([
      'universal',
      'universal',
    ]);
    expect(projectSkillRows(project, null, 'universal')).toEqual([]);
  });
});

describe('filterProjectSkillRows', () => {
  it('matches name, description and provider ids, case-insensitively', () => {
    const rows = projectSkillRows(project, global, 'all');

    expect(filterProjectSkillRows(rows, '  ')).toHaveLength(3);
    expect(filterProjectSkillRows(rows, 'UNIVERSAL-ONLY').map((row) => row.skill.name)).toEqual([
      'universal-only',
    ]);
    expect(filterProjectSkillRows(rows, 'shared description').map((row) => row.skill.name)).toEqual(
      ['shared'],
    );
    expect(filterProjectSkillRows(rows, 'claude-code')).toHaveLength(3);
  });
});
