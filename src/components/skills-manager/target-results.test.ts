import { describe, expect, it } from 'vitest';
import { summarizeTargetResults } from './target-results';

describe('summarizeTargetResults', () => {
  it('treats an empty result set as fully settled', () => {
    expect(summarizeTargetResults({ results: [] })).toEqual({
      settled: 0,
      unsettled: 0,
      issues: '',
      firstMessage: undefined,
    });
  });

  it('counts written and already_present as settled', () => {
    expect(
      summarizeTargetResults({
        results: [
          { providerId: 'claude-code', status: 'written' },
          { providerId: 'universal', status: 'already_present' },
        ],
      }),
    ).toMatchObject({ settled: 2, unsettled: 0, issues: '' });
  });

  it('names the unsettled providers and keeps the first message', () => {
    expect(
      summarizeTargetResults({
        results: [
          { providerId: 'claude-code', status: 'removed' },
          { providerId: 'cursor', status: 'conflict', message: 'something is in the way' },
          { providerId: 'unknown-agent', status: 'failed' },
        ],
      }),
    ).toEqual({
      settled: 1,
      unsettled: 2,
      issues: 'Cursor, unknown-agent',
      firstMessage: 'something is in the way',
    });
  });
});
