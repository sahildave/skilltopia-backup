import { describe, expect, it } from 'vitest';
import { parseTokenOutput } from './with-ingest-oidc.mjs';

describe('parseTokenOutput', () => {
  it('reads the pretty-printed JSON the CLI actually emits', () => {
    expect(parseTokenOutput('{\n  "token": "abc"\n}\n')).toBe('abc');
  });

  it('tolerates a banner line before the JSON', () => {
    expect(parseTokenOutput('Vercel CLI 59.3.0\n{\n  "token": "abc"\n}\n')).toBe('abc');
  });

  it('reads compact JSON too', () => {
    expect(parseTokenOutput('{"token":"abc"}')).toBe('abc');
  });

  it('throws when there is no token rather than passing undefined onward', () => {
    expect(() => parseTokenOutput('{"error":"nope"}')).toThrow('no token');
  });
});
