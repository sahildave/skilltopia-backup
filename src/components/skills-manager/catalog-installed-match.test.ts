import { describe, expect, it } from 'vitest';
import type { SkillsShSkill } from '@/catalog/types';
import { MOCK_INSTALLED_SCAN } from '@/platform/fixtures';
import {
  catalogSourceForScannedSkill,
  catalogSourcesByInstalledKey,
  installedSkillKeysFromSnapshot,
  isCatalogSkillInstalled,
} from './catalog-installed-match';

function catalogSkill(
  partial: Partial<SkillsShSkill> & Pick<SkillsShSkill, 'id' | 'slug'>,
): SkillsShSkill {
  return {
    name: partial.slug,
    source: 'owner/repo',
    installs: 0,
    sourceType: 'github',
    url: `https://skills.sh/${partial.id}`,
    ...partial,
  };
}

describe('catalog-installed-match', () => {
  it('builds keys from uninstallName and name', () => {
    const keys = installedSkillKeysFromSnapshot(MOCK_INSTALLED_SCAN);
    expect(keys.has('find-skills')).toBe(true);
    expect(keys.has('frontend-design')).toBe(true);
    expect(keys.has('code-review')).toBe(true);
  });

  it('returns an empty set when snapshot is missing', () => {
    expect(installedSkillKeysFromSnapshot(null).size).toBe(0);
    expect(installedSkillKeysFromSnapshot(undefined).size).toBe(0);
  });

  it('matches catalog skills by slug', () => {
    const keys = installedSkillKeysFromSnapshot(MOCK_INSTALLED_SCAN);
    expect(
      isCatalogSkillInstalled(
        catalogSkill({ id: 'vercel-labs/skills/find-skills', slug: 'find-skills' }),
        keys,
      ),
    ).toBe(true);
    expect(
      isCatalogSkillInstalled(
        catalogSkill({ id: 'other/repo/missing-skill', slug: 'missing-skill' }),
        keys,
      ),
    ).toBe(false);
  });

  it('matches by id tail when slug differs', () => {
    const keys = installedSkillKeysFromSnapshot(MOCK_INSTALLED_SCAN);
    expect(
      isCatalogSkillInstalled(
        catalogSkill({
          id: 'anthropics/skills/frontend-design',
          slug: 'Frontend Design',
        }),
        keys,
      ),
    ).toBe(true);
  });

  it('maps catalog source onto installed keys', () => {
    const map = catalogSourcesByInstalledKey([
      catalogSkill({
        id: 'vercel-labs/agent-skills/find-skills',
        slug: 'find-skills',
        source: 'vercel-labs/agent-skills',
      }),
      catalogSkill({
        id: 'anthropics/skills/frontend-design',
        slug: 'Frontend Design',
        source: 'anthropics/skills',
      }),
    ]);

    expect(map.get('find-skills')).toBe('vercel-labs/agent-skills');
    expect(map.get('frontend-design')).toBe('anthropics/skills');

    const findSkills = MOCK_INSTALLED_SCAN.skills.find((s) => s.name === 'find-skills');
    expect(findSkills).toBeDefined();
    if (!findSkills) return;
    expect(catalogSourceForScannedSkill(findSkills, map)).toBe('vercel-labs/agent-skills');
  });

  it('keeps the first catalog source when keys collide', () => {
    const map = catalogSourcesByInstalledKey([
      catalogSkill({
        id: 'a/repo/find-skills',
        slug: 'find-skills',
        source: 'a/repo',
      }),
      catalogSkill({
        id: 'b/repo/find-skills',
        slug: 'find-skills',
        source: 'b/repo',
      }),
    ]);
    expect(map.get('find-skills')).toBe('a/repo');
  });
});
