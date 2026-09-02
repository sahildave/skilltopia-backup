import { describe, expect, it } from 'vitest';
import type { SkillsShSkill } from '@/catalog/types';
import { countSkillCategories, filterSkillsByCategory } from './skill-category-model';

const skills: SkillsShSkill[] = [
  {
    id: 'one',
    slug: 'one',
    name: 'One',
    source: 'source',
    installs: 1,
    sourceType: 'github',
    url: 'https://skills.sh/one',
    categories: ['git-github', 'search-research'],
  },
  {
    id: 'two',
    slug: 'two',
    name: 'Two',
    source: 'source',
    installs: 2,
    sourceType: 'github',
    url: 'https://skills.sh/two',
    categories: ['git-github'],
  },
  {
    id: 'three',
    slug: 'three',
    name: 'Three',
    source: 'source',
    installs: 3,
    sourceType: 'github',
    url: 'https://skills.sh/three',
  },
];

describe('skill category model', () => {
  it('counts every taxonomy category, including zero-result categories', () => {
    const counts = countSkillCategories(skills);

    expect(counts['git-github']).toBe(2);
    expect(counts['search-research']).toBe(1);
    expect(counts['devops-cloud']).toBe(0);
  });

  it('filters only verified category assignments and preserves order', () => {
    expect(filterSkillsByCategory(skills, 'git-github').map((skill) => skill.id)).toEqual([
      'one',
      'two',
    ]);
    expect(filterSkillsByCategory(skills, null).map((skill) => skill.id)).toEqual([
      'one',
      'two',
      'three',
    ]);
  });
});
