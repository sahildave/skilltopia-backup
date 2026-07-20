import { describe, expect, it } from 'vitest';
import type { SkillsShSkill } from '@/catalog/types';
import { MOCK_INSTALLED_SCAN } from '@/platform/fixtures';
import {
  installedSkillKeysFromSnapshot,
  isCatalogSkillInstalled,
} from './catalog-installed-match';

function catalogSkill(partial: Partial<SkillsShSkill> & Pick<SkillsShSkill, 'id' | 'slug'>): SkillsShSkill {
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
});
