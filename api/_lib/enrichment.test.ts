import { describe, expect, it, vi } from 'vitest';
import { distilledEnrichmentText, enrichWithModel, extractRuleBased } from './enrichment.js';

describe('rule-based enrichment', () => {
  it('produces usable required fields from a markdown skill', () => {
    const result = extractRuleBased(
      '# React accessibility\n\nBuild accessible React interfaces.\n\n## Requirements\n- React\n- TypeScript\n\n## Best for\n- Product teams',
    );

    expect(result.required.primaryGoal).toContain('Build accessible React');
    expect(result.required.requires).toEqual(['React', 'TypeScript']);
    expect(result.required.bestFor).toEqual(['Product teams']);
  });
});

describe('AI fallback chain', () => {
  it('falls back to rule-based enrichment after every model fails', async () => {
    const pause = vi.fn().mockResolvedValue(undefined);
    const result = await enrichWithModel(
      '# Skill\n\nBuild useful things.',
      [{} as never, {} as never],
      undefined,
      pause,
    );

    expect(result.required.primaryGoal).toContain('Build useful things');
    expect(pause).toHaveBeenCalledWith(1000);
  });
});

describe('distilled enrichment', () => {
  it('creates stable searchable text', () => {
    expect(
      distilledEnrichmentText({
        required: {
          primaryGoal: 'Build interfaces',
          requires: ['React'],
          estimatedComplexity: 'low',
          bestFor: ['teams'],
        },
        optional: {},
      }),
    ).toContain('Goal: Build interfaces');
  });
});
