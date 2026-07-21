import { resolveInstallSeries } from '../_lib/page-snapshot.js';
import { enforceRateLimit, methodNotAllowed } from '../_lib/proxy.js';
import { searchNearestSkills } from '../_lib/qdrant.js';
import { parseSkillDetailQuery } from '../_lib/query.js';
import { createSupabaseRepositoryFromEnv } from '../_lib/supabase-repository.js';

export async function GET(request: Request): Promise<Response> {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const parsed = parseSkillDetailQuery(new URL(request.url).searchParams);
  if (!parsed.ok) return Response.json(parsed.body, { status: parsed.status });

  const skillId = parsed.query.get('skill_id');
  if (!skillId) return Response.json({ error: 'invalid_query' }, { status: 400 });
  const repository = createSupabaseRepositoryFromEnv();

  const pageCache = await repository.getSkillPageCache(skillId);
  let installSeries: number[] = [];
  if (pageCache) {
    const snapshots = pageCache.pageSnapshot?.weeklyInstalls?.length
      ? []
      : await repository.listInstallSnapshots(skillId, 8);
    installSeries = resolveInstallSeries(pageCache.pageSnapshot?.weeklyInstalls, snapshots);
  }

  const enrichment = await repository.getSkillEnrichment(skillId);
  const base = {
    skillId,
    pageSnapshot: pageCache?.pageSnapshot ?? null,
    pageScrapedAt: pageCache?.pageScrapedAt ?? null,
    repository: pageCache?.pageSnapshot?.repository ?? pageCache?.repository ?? null,
    installCount: pageCache?.installCount ?? null,
    sourceUrl: pageCache?.sourceUrl ?? null,
    installSeries,
    enrichment: enrichment ?? null,
    related: [] as Array<{
      skillId: string;
      score: number;
      repository: string | null;
      sourceUrl: string | null;
      installCount: number | null;
    }>,
  };

  if (!enrichment) {
    return Response.json({ data: base });
  }

  let related: Awaited<ReturnType<typeof searchNearestSkills>> = [];
  try {
    related = await searchNearestSkills(skillId, 6);
  } catch {
    // Related skills are optional; the enrichment remains useful without Qdrant.
  }

  let metadata = [] as Awaited<ReturnType<typeof repository.getSkillMetadata>>;
  try {
    metadata = await repository.getSkillMetadata(related.map((item) => item.skillId));
  } catch {
    // Hydration is optional; return the enrichment if metadata is unavailable.
  }
  const metadataById = new Map(metadata.map((item) => [item.skillId, item]));

  return Response.json({
    data: {
      ...base,
      related: related.flatMap((item) => {
        const itemMetadata = metadataById.get(item.skillId);
        return itemMetadata
          ? [
              {
                skillId: item.skillId,
                score: item.score,
                repository: itemMetadata.repository ?? null,
                sourceUrl: itemMetadata.sourceUrl ?? null,
                installCount: itemMetadata.installCount ?? null,
              },
            ]
          : [];
      }),
    },
  });
}

export async function POST(): Promise<Response> {
  return methodNotAllowed();
}
