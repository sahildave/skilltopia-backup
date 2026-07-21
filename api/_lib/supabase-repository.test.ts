import { describe, expect, it, vi } from 'vitest';
import {
  createSupabaseRepository,
  estimateReadTimeMinutes,
  type RawSkillFile,
  type SkillEnrichmentRecord,
} from './supabase-repository.js';

function createClient() {
  const metadata = {
    upsert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  };
  const rawFiles = {
    upsert: vi.fn(),
    select: vi.fn(),
  };
  const installSnapshots = {
    upsert: vi.fn(),
    select: vi.fn(),
  };
  const storageBucket = {
    upload: vi.fn(),
    download: vi.fn(),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'skill_metadata') return metadata;
      if (table === 'skill_install_snapshots') return installSnapshots;
      return rawFiles;
    }),
    storage: {
      from: vi.fn(() => storageBucket),
    },
    metadata,
    rawFiles,
    installSnapshots,
    storageBucket,
  };
}

const enrichment: SkillEnrichmentRecord = {
  skillId: 'owner/skill',
  contentHash: 'sha256:abc',
  required: {
    primaryGoal: 'Improve code quality',
    requires: ['TypeScript'],
    estimatedComplexity: 'medium',
    bestFor: ['developers'],
  },
  optional: { worksWith: ['React'] },
  estimatedReadTimeMinutes: 2,
};

const enrichmentRow = {
  skill_id: enrichment.skillId,
  content_hash: enrichment.contentHash,
  enrichment_required: enrichment.required,
  enrichment_optional: enrichment.optional,
  estimated_read_time_minutes: enrichment.estimatedReadTimeMinutes,
};

describe('Supabase skill repository', () => {
  it('derives a minimum one-minute read time from content length', () => {
    expect(estimateReadTimeMinutes('one two three')).toBe(1);
    expect(estimateReadTimeMinutes(Array.from({ length: 201 }, () => 'word').join(' '))).toBe(2);
  });

  it('upserts and reads enrichment by skill id', async () => {
    const client = createClient();
    client.metadata.upsert.mockReturnValue({
      select: () => ({
        single: async () => ({ data: enrichmentRow, error: null }),
      }),
    });
    client.metadata.select.mockReturnValue({
      eq: () => ({
        maybeSingle: async () => ({ data: enrichmentRow, error: null }),
      }),
    });

    const repository = createSupabaseRepository(client as never);

    await expect(repository.upsertSkillEnrichment(enrichment)).resolves.toEqual(enrichment);
    await expect(repository.getSkillEnrichment(enrichment.skillId)).resolves.toEqual(enrichment);
    expect(client.metadata.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        skill_id: enrichment.skillId,
        enrichment_required: enrichment.required,
        enrichment_optional: enrichment.optional,
      }),
      { onConflict: 'skill_id' },
    );
  });

  it('reads enrichment when page-cache columns are present but null', async () => {
    const client = createClient();
    const rowWithPageCache = {
      ...enrichmentRow,
      page_snapshot: null,
      audits: null,
      audits_fetched_at: null,
      page_scraped_at: null,
    };
    client.metadata.select.mockReturnValue({
      eq: () => ({
        maybeSingle: async () => ({ data: rowWithPageCache, error: null }),
      }),
      in: async () => ({ data: [rowWithPageCache], error: null }),
    });

    const repository = createSupabaseRepository(client as never);

    await expect(repository.getSkillEnrichment(enrichment.skillId)).resolves.toEqual(enrichment);
    await expect(repository.getSkillMetadata([enrichment.skillId])).resolves.toEqual([
      {
        ...enrichment,
        sourceUrl: undefined,
        repository: undefined,
        installCount: undefined,
        rawStoragePrefix: undefined,
      },
    ]);
  });

  it('distinguishes missing enrichment from a content-hash match', async () => {
    const client = createClient();
    client.metadata.select
      .mockReturnValueOnce({
        is: () => ({
          order: () => ({
            limit: async () => ({
              data: [{ skill_id: 'missing/skill' }],
              error: null,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        eq: () => ({
          not: () => ({
            order: async () => ({ data: [enrichmentRow], error: null }),
          }),
        }),
      });

    const repository = createSupabaseRepository(client as never);

    await expect(repository.listMissingEnrichment()).resolves.toEqual([
      { skillId: 'missing/skill' },
    ]);
    await expect(repository.getByContentHash(enrichment.contentHash)).resolves.toEqual([
      enrichment,
    ]);
  });

  it('stores raw files in Storage and reloads them through the repository', async () => {
    const client = createClient();
    client.storageBucket.upload.mockResolvedValue({ data: {}, error: null });
    client.storageBucket.download.mockResolvedValue({
      data: new Blob(['# Skill']),
      error: null,
    });
    client.rawFiles.upsert.mockReturnValue({
      data: [],
      error: null,
    });
    client.rawFiles.select.mockReturnValue({
      eq: () => ({
        order: async () => ({
          data: [{ file_path: 'SKILL.md', storage_path: 'owner/skill/SKILL.md' }],
          error: null,
        }),
      }),
    });

    const files: RawSkillFile[] = [{ path: 'SKILL.md', content: '# Skill' }];
    const repository = createSupabaseRepository(client as never);

    await repository.putRawSkillFiles(enrichment.skillId, files);
    await expect(repository.getRawSkillFiles(enrichment.skillId)).resolves.toEqual({
      'SKILL.md': '# Skill',
    });
    expect(client.storageBucket.upload).toHaveBeenCalledWith(
      'owner/skill/SKILL.md',
      '# Skill',
      expect.objectContaining({ contentType: 'text/markdown', upsert: true }),
    );
  });

  it('upserts page snapshot and scrape timestamp', async () => {
    const client = createClient();
    client.metadata.update.mockReturnValue({
      eq: async () => ({ data: null, error: null }),
    });
    const repository = createSupabaseRepository(client as never);
    const snapshot = { summary: 'A skill', weeklyInstalls: [1, 2, 3, 4, 5, 6, 7, 8] };

    await repository.upsertPageSnapshot(enrichment.skillId, snapshot, '2026-07-21T00:00:00.000Z');

    expect(client.metadata.update).toHaveBeenCalledWith({
      page_snapshot: snapshot,
      page_scraped_at: '2026-07-21T00:00:00.000Z',
    });
  });

  it('reads and updates skill audit cache columns', async () => {
    const client = createClient();
    const audits = {
      id: enrichment.skillId,
      source: 'owner/repo',
      slug: 'skill',
      audits: [
        {
          provider: 'Socket',
          slug: 'socket',
          status: 'pass',
          summary: 'No alerts',
          auditedAt: '2026-04-15T12:05:00.000Z',
        },
      ],
    };
    client.metadata.select.mockReturnValue({
      eq: () => ({
        maybeSingle: async () => ({
          data: {
            content_hash: enrichment.contentHash,
            audits,
            audits_fetched_at: '2026-07-20T00:00:00.000Z',
          },
          error: null,
        }),
      }),
    });
    client.metadata.update.mockReturnValue({
      eq: async () => ({ data: null, error: null }),
    });

    const repository = createSupabaseRepository(client as never);
    await expect(repository.getSkillAuditCache(enrichment.skillId)).resolves.toEqual({
      contentHash: enrichment.contentHash,
      audits,
      auditsFetchedAt: '2026-07-20T00:00:00.000Z',
    });

    await repository.upsertSkillAudits(enrichment.skillId, audits, '2026-07-21T00:00:00.000Z');
    expect(client.metadata.update).toHaveBeenCalledWith({
      audits,
      audits_fetched_at: '2026-07-21T00:00:00.000Z',
    });
  });

  it('syncs list sightings without clobbering existing content hashes', async () => {
    const client = createClient();
    client.metadata.select.mockReturnValue({
      in: async () => ({
        data: [{ skill_id: 'existing/skill', content_hash: 'sha256:keep' }],
        error: null,
      }),
    });
    client.metadata.upsert.mockResolvedValue({ data: null, error: null });

    const repository = createSupabaseRepository(client as never);
    await expect(
      repository.syncListSkills([
        { skillId: 'existing/skill', installCount: 42, repository: 'existing/repo' },
        { skillId: 'new/skill', installCount: 7, repository: 'new/repo' },
      ]),
    ).resolves.toEqual({ queued: ['new/skill'] });

    expect(client.metadata.upsert).toHaveBeenCalledWith(
      [
        {
          skill_id: 'existing/skill',
          content_hash: 'sha256:keep',
          install_count: 42,
          repository: 'existing/repo',
          raw_storage_prefix: 'existing/skill',
        },
        {
          skill_id: 'new/skill',
          content_hash: '',
          install_count: 7,
          repository: 'new/repo',
          raw_storage_prefix: 'new/skill',
        },
      ],
      { onConflict: 'skill_id' },
    );
  });

  it('counts and upserts install snapshots', async () => {
    const client = createClient();
    client.installSnapshots.select.mockReturnValue({
      eq: () => ({
        // head + count path
      }),
    });
    // Supabase count query: select('*', { count: 'exact', head: true }).eq(...)
    client.from.mockImplementation((table: string) => {
      if (table === 'skill_install_snapshots') {
        return {
          select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) {
              return {
                eq: async () => ({ count: 3, error: null }),
              };
            }
            return client.installSnapshots.select();
          },
          upsert: client.installSnapshots.upsert,
        };
      }
      if (table === 'skill_metadata') return client.metadata;
      return client.rawFiles;
    });
    client.installSnapshots.upsert.mockResolvedValue({ data: null, error: null });

    const repository = createSupabaseRepository(client as never);
    await expect(repository.countInstallSnapshots(enrichment.skillId)).resolves.toBe(3);

    const rows = [
      { skillId: enrichment.skillId, date: '2026-07-14', installs: 10 },
      { skillId: enrichment.skillId, date: '2026-07-15', installs: 11 },
    ];
    await repository.upsertInstallSnapshots(rows);
    expect(client.installSnapshots.upsert).toHaveBeenCalledWith(
      [
        { skill_id: enrichment.skillId, date: '2026-07-14', installs: 10 },
        { skill_id: enrichment.skillId, date: '2026-07-15', installs: 11 },
      ],
      { onConflict: 'skill_id,date' },
    );
  });

  it('loads page cache metadata and recent install snapshots', async () => {
    const client = createClient();
    const snapshot = {
      summary: 'A skill',
      topics: ['design'],
      repository: 'anthropics/skills',
      weeklyInstalls: [1, 2, 3, 4, 5, 6, 7, 8],
    };
    client.metadata.select.mockReturnValue({
      eq: () => ({
        maybeSingle: async () => ({
          data: {
            skill_id: enrichment.skillId,
            page_snapshot: snapshot,
            page_scraped_at: '2026-07-21T00:00:00.000Z',
            repository: 'anthropics/skills',
            source: null,
            install_count: 42,
            source_url: 'https://www.skills.sh/anthropics/skills/frontend-design',
          },
          error: null,
        }),
      }),
    });
    client.installSnapshots.select.mockReturnValue({
      eq: () => ({
        order: () => ({
          limit: async () => ({
            data: [
              { skill_id: enrichment.skillId, date: '2026-07-21', installs: 42 },
              { skill_id: enrichment.skillId, date: '2026-07-20', installs: 40 },
            ],
            error: null,
          }),
        }),
      }),
    });

    const repository = createSupabaseRepository(client as never);
    await expect(repository.getSkillPageCache(enrichment.skillId)).resolves.toEqual({
      skillId: enrichment.skillId,
      pageSnapshot: snapshot,
      pageScrapedAt: '2026-07-21T00:00:00.000Z',
      repository: 'anthropics/skills',
      source: null,
      installCount: 42,
      sourceUrl: 'https://www.skills.sh/anthropics/skills/frontend-design',
    });
    await expect(repository.listInstallSnapshots(enrichment.skillId, 8)).resolves.toEqual([
      { skillId: enrichment.skillId, date: '2026-07-20', installs: 40 },
      { skillId: enrichment.skillId, date: '2026-07-21', installs: 42 },
    ]);
  });

  it('returns null page cache when skill metadata row is missing', async () => {
    const client = createClient();
    client.metadata.select.mockReturnValue({
      eq: () => ({
        maybeSingle: async () => ({ data: null, error: null }),
      }),
    });
    const repository = createSupabaseRepository(client as never);
    await expect(repository.getSkillPageCache(enrichment.skillId)).resolves.toBeNull();
  });

  it('lists oldest page scrapes and empty-hash detail queue', async () => {
    const client = createClient();
    const order = vi.fn().mockReturnValue({
      limit: async () => ({
        data: [{ skill_id: 'old/a' }, { skill_id: 'old/b' }],
        error: null,
      }),
    });
    client.metadata.select.mockReturnValue({
      order,
      eq: () => ({
        order: () => ({
          limit: async () => ({
            data: [{ skill_id: 'new/a' }],
            error: null,
          }),
        }),
      }),
    });

    const repository = createSupabaseRepository(client as never);
    await expect(repository.listOldestPageScraped(2)).resolves.toEqual(['old/a', 'old/b']);
    expect(order).toHaveBeenCalledWith('page_scraped_at', { ascending: true, nullsFirst: true });

    await expect(repository.listQueuedDetailSkills(10)).resolves.toEqual(['new/a']);
  });
});
