import { describe, expect, it, vi } from 'vitest';
import {
  AUDIT_STALE_MS,
  refreshSkillAuditsIfNeeded,
  resolveSkillAudits,
  shouldRefreshAudits,
  type SkillAuditsPayload,
} from './audit-cache.js';

const SAMPLE: SkillAuditsPayload = {
  id: 'owner/repo/skill',
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

describe('shouldRefreshAudits', () => {
  it('refreshes when hash changed even if audits are fresh', () => {
    expect(
      shouldRefreshAudits({
        hashChanged: true,
        audits: SAMPLE,
        auditsFetchedAt: new Date().toISOString(),
      }),
    ).toBe(true);
  });

  it('refreshes when audits are missing', () => {
    expect(
      shouldRefreshAudits({
        hashChanged: false,
        audits: null,
        auditsFetchedAt: null,
      }),
    ).toBe(true);
  });

  it('refreshes when audits_fetched_at is older than 7 days', () => {
    const now = Date.parse('2026-07-21T00:00:00.000Z');
    expect(
      shouldRefreshAudits({
        hashChanged: false,
        audits: SAMPLE,
        auditsFetchedAt: new Date(now - AUDIT_STALE_MS - 1).toISOString(),
        now,
      }),
    ).toBe(true);
  });

  it('keeps cache when hash unchanged and within 7-day window', () => {
    const now = Date.parse('2026-07-21T00:00:00.000Z');
    expect(
      shouldRefreshAudits({
        hashChanged: false,
        audits: SAMPLE,
        auditsFetchedAt: new Date(now - AUDIT_STALE_MS + 60_000).toISOString(),
        now,
      }),
    ).toBe(false);
  });
});

describe('resolveSkillAudits', () => {
  it('serves fresh cache without calling upstream', async () => {
    const fetchAudits = vi.fn();
    const upsertSkillAudits = vi.fn();
    const now = Date.parse('2026-07-21T00:00:00.000Z');

    const result = await resolveSkillAudits({
      skillId: SAMPLE.id,
      repository: {
        getSkillAuditCache: async () => ({
          contentHash: 'sha256:abc',
          audits: SAMPLE,
          auditsFetchedAt: new Date(now - 60_000).toISOString(),
        }),
        upsertSkillAudits,
      },
      fetchAudits,
      now,
    });

    expect(result).toEqual({
      skillId: SAMPLE.id,
      audits: SAMPLE,
      source: 'cache',
      auditsFetchedAt: new Date(now - 60_000).toISOString(),
    });
    expect(fetchAudits).not.toHaveBeenCalled();
    expect(upsertSkillAudits).not.toHaveBeenCalled();
  });

  it('returns upstream audits before async persist settles', async () => {
    let finishPersist!: () => void;
    const persistGate = new Promise<void>((resolve) => {
      finishPersist = resolve;
    });
    const upsertSkillAudits = vi.fn(async () => {
      await persistGate;
    });
    const scheduled: Array<() => Promise<void>> = [];

    const resultPromise = resolveSkillAudits({
      skillId: SAMPLE.id,
      repository: {
        getSkillAuditCache: async () => null,
        upsertSkillAudits,
      },
      fetchAudits: async () => SAMPLE,
      schedulePersist: (task) => {
        scheduled.push(task);
      },
    });

    const result = await resultPromise;
    expect(result).toEqual({
      skillId: SAMPLE.id,
      audits: SAMPLE,
      source: 'upstream',
      auditsFetchedAt: expect.any(String),
    });
    expect(upsertSkillAudits).not.toHaveBeenCalled();

    expect(scheduled).toHaveLength(1);
    const persistPromise = scheduled[0]!();
    expect(upsertSkillAudits).toHaveBeenCalledWith(SAMPLE.id, SAMPLE, result.auditsFetchedAt);
    finishPersist();
    await persistPromise;
  });
});

describe('refreshSkillAuditsIfNeeded', () => {
  it('skips upstream when hash and stale window say cache is fresh', async () => {
    const fetchAudits = vi.fn();
    const upsertSkillAudits = vi.fn();
    const now = Date.parse('2026-07-21T00:00:00.000Z');

    await expect(
      refreshSkillAuditsIfNeeded({
        skillId: SAMPLE.id,
        currentHash: 'sha256:abc',
        repository: {
          getSkillAuditCache: async () => ({
            contentHash: 'sha256:abc',
            audits: SAMPLE,
            auditsFetchedAt: new Date(now - 60_000).toISOString(),
          }),
          upsertSkillAudits,
        },
        fetchAudits,
        now,
      }),
    ).resolves.toEqual({ refreshed: false, audits: SAMPLE });

    expect(fetchAudits).not.toHaveBeenCalled();
    expect(upsertSkillAudits).not.toHaveBeenCalled();
  });

  it('fetches and upserts when content hash changed', async () => {
    const fetchAudits = vi.fn(async () => SAMPLE);
    const upsertSkillAudits = vi.fn();
    const now = Date.parse('2026-07-21T00:00:00.000Z');

    await expect(
      refreshSkillAuditsIfNeeded({
        skillId: SAMPLE.id,
        currentHash: 'sha256:new',
        previousContentHash: 'sha256:old',
        repository: {
          getSkillAuditCache: async () => ({
            contentHash: 'sha256:new',
            audits: SAMPLE,
            auditsFetchedAt: new Date(now - 60_000).toISOString(),
          }),
          upsertSkillAudits,
        },
        fetchAudits,
        now,
      }),
    ).resolves.toEqual({ refreshed: true, audits: SAMPLE });

    expect(fetchAudits).toHaveBeenCalledWith(SAMPLE.id);
    expect(upsertSkillAudits).toHaveBeenCalledWith(SAMPLE.id, SAMPLE, expect.any(String));
  });
});
