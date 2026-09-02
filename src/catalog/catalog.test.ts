import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { catalog as mockCatalog } from './index.mock';
import { catalog as webCatalog } from './index.web';
import { MOCK_AUDITS, MOCK_DETAIL, MOCK_LEADERBOARD } from './fixtures';

describe('CatalogPort mock', () => {
  it('returns fixture leaderboard capped by perPage', async () => {
    const skills = await mockCatalog.fetchLeaderboard('all-time', 0, 1);
    expect(skills).toEqual([MOCK_LEADERBOARD[0]]);
  });

  it('filters search results by name', async () => {
    const result = await mockCatalog.search('frontend', 10, []);
    expect(result).toEqual({ skills: [MOCK_LEADERBOARD[1]], semanticUnavailable: false });
  });

  it('returns fixture detail for known skill id', async () => {
    const detail = await mockCatalog.fetchDetail(MOCK_DETAIL.skillId);
    expect(detail).toEqual(MOCK_DETAIL);
  });

  it('returns fixture audits for known skill id', async () => {
    const audits = await mockCatalog.fetchAudits(MOCK_AUDITS.skillId);
    expect(audits).toEqual(MOCK_AUDITS);
  });
});

describe('CatalogPort web', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches leaderboard from relative /api/skills', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: MOCK_LEADERBOARD }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const skills = await webCatalog.fetchLeaderboard('trending', 0, 12);

    expect(fetch).toHaveBeenCalledWith('/api/skills?view=trending&page=0&per_page=12');
    expect(skills).toEqual(MOCK_LEADERBOARD);
  });

  it('fetches search from relative /api/skills/search', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [MOCK_LEADERBOARD[0]] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await webCatalog.search('find', 50, []);

    expect(fetch).toHaveBeenCalledWith('/api/skills/search?q=find&limit=50');
    expect(result).toEqual({ skills: [MOCK_LEADERBOARD[0]], semanticUnavailable: false });
  });

  it('passes the selected categories as the category facet', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await webCatalog.search('find', 50, ['git-github', 'cli-utilities']);

    expect(fetch).toHaveBeenCalledWith(
      '/api/skills/search?q=find&limit=50&category=git-github%2Ccli-utilities',
    );
  });

  it('throws when the catalog response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('nope', { status: 503, statusText: 'Service Unavailable' }),
    );

    await expect(webCatalog.fetchLeaderboard('all-time', 0, 10)).rejects.toThrow(/503/);
  });
});
