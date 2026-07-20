import { describe, expect, it } from 'vitest';
import { mergeHybridSearchResults } from './hybrid-search.js';

describe('mergeHybridSearchResults', () => {
  it('keeps keyword results ahead of semantic results and removes duplicates', () => {
    const results = mergeHybridSearchResults(
      'react',
      [
        { id: 'owner/react', installs: 10, name: 'React' },
        { id: 'owner/forms', installs: 1000, name: 'Forms' },
      ],
      [
        { skillId: 'owner/forms', score: 0.99 },
        { skillId: 'owner/testing', score: 0.8 },
      ],
      [{ skillId: 'owner/testing', installCount: 100, source: 'owner' }],
      10,
    );

    expect(results.map((result) => result.id)).toEqual([
      'owner/react',
      'owner/forms',
      'owner/testing',
    ]);
  });

  it('boosts exact and highly installed keyword matches within keyword results', () => {
    const results = mergeHybridSearchResults(
      'react',
      [
        { id: 'owner/other', installs: 1000000 },
        { id: 'react', installs: 1 },
      ],
      [],
      [],
      10,
    );

    expect(results.map((result) => result.id)).toEqual(['react', 'owner/other']);
  });

  it('degrades to keyword-only results when semantic metadata is missing', () => {
    expect(
      mergeHybridSearchResults(
        'query',
        [{ id: 'owner/keyword', installs: 1 }],
        [{ skillId: 'owner/unhydrated', score: 1 }],
        [],
        10,
      ),
    ).toEqual([{ id: 'owner/keyword', installs: 1 }]);
  });
});
