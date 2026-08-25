import { describe, expect, it } from 'vitest';
import { isGitRuntimeMissing } from './library-errors';

describe('library errors', () => {
  it('recognizes the missing Git error returned by Rust', () => {
    expect(isGitRuntimeMissing('git_runtime_not_found: Install Git')).toBe(true);
    expect(isGitRuntimeMissing('git failed: repository not found')).toBe(false);
  });
});
