import { enforceRateLimit, fetchAppCatalogJson, methodNotAllowed } from '../_lib/proxy.js';
import { fetchLeaderboard } from '../_lib/skills-catalog.js';
import { createSupabaseRepositoryFromEnv } from '../_lib/supabase-repository.js';

const SEED_COUNT = 12;

export async function GET(request: Request): Promise<Response> {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const skills = (await fetchLeaderboard(SEED_COUNT, fetchAppCatalogJson)).slice(0, SEED_COUNT);
  const repository = createSupabaseRepositoryFromEnv();
  const enrichment = await repository.getSkillMetadata(skills.map((skill) => skill.id));
  const enrichmentById = new Map(enrichment.map((item) => [item.skillId, item]));

  return Response.json({
    skills: skills.map((skill) => ({
      ...skill,
      name: skill.name ?? skill.slug,
      sourceType: skill.sourceType ?? 'github',
      url: skill.url ?? `https://skills.sh/${skill.id}`,
    })),
    details: skills.flatMap((skill) => {
      const item = enrichmentById.get(skill.id);
      return item ? [{ skillId: skill.id, enrichment: item, related: [] }] : [];
    }),
  });
}

export async function POST(): Promise<Response> {
  return methodNotAllowed();
}
