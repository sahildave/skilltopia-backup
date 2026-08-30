import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import '@/i18n/config';
import { SKILL_CATEGORIES } from '../../api/_lib/taxonomy';
import { useSkillCategories, useSkillCategory } from './use-skill-categories';

describe('useSkillCategories', () => {
  it('binds every taxonomy slug to an icon and a translated label', () => {
    const { result } = renderHook(() => useSkillCategories());

    expect(result.current.map((binding) => binding.key)).toEqual([...SKILL_CATEGORIES]);

    for (const binding of result.current) {
      expect(binding.icon).toBeTypeOf('object');
      expect(binding.label).not.toBe(`skillCategory.${binding.key}`);
      expect(binding.label.trim()).not.toBe('');
    }
  });
});

describe('useSkillCategory', () => {
  it('resolves the primary category, ignoring the rest', () => {
    const { result } = renderHook(() => useSkillCategory(['git-github', 'cli-utilities']));

    expect(result.current?.key).toBe('git-github');
    expect(result.current?.label).toBe('Git & GitHub');
  });

  it('returns null for an empty or unrecognised category list', () => {
    expect(renderHook(() => useSkillCategory([])).result.current).toBeNull();
    expect(renderHook(() => useSkillCategory(['not-a-slug'])).result.current).toBeNull();
  });
});
