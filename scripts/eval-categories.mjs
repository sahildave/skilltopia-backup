// Eval harness for the skill category classifier (issue #56).
// Reuses the production classifier (enrichWithModel) with NO Supabase/Qdrant
// writes — pure classification vs the human gold set. Persistence to the
// corpus is #58's job, not the eval's.
//
//   npm run eval:categories          # full gold set
//   LIMIT=1 npm run eval:categories  # single-skill sanity run
//
// Env: LIMIT caps items (sanity run LIMIT=1). OUT sets the results path.
// Model routing (chain/base URL) is handled by scripts/with-ollama.mjs.
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchSkillDetail } from '../api/_lib/skills-catalog.ts';
import { enrichWithModel } from '../api/_lib/enrichment.ts';
import { createModelsFromEnv } from '../api/_lib/enrichment-pipeline.ts';

const gold = JSON.parse(readFileSync('docs/developer/category-goldset.json', 'utf8')).skills;
const limit = Number.parseInt(process.env.LIMIT ?? String(gold.length), 10);
const items = gold.slice(0, limit);
const outPath = process.env.OUT ?? '/tmp/eval-categories-results.json';

const models = createModelsFromEnv();
if (models.length === 0) {
  console.error(
    'FATAL: no models resolved from env — check ENRICHMENT_MODEL_CHAIN/OPENAI_API_KEY/OPENAI_BASE_URL',
  );
  process.exit(2);
}
console.error(
  `models: ${models.map((m) => ('modelId' in m ? String(m.modelId) : '?')).join(' → ')}`,
);

const jaccard = (a, b) => {
  const A = new Set(a),
    B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 1 : inter / union;
};

const rows = [];
for (const [i, skill] of items.entries()) {
  process.stderr.write(`[${i + 1}/${items.length}] ${skill.id} … `);
  let modelCats = [];
  let confidence = 'error';
  let error = null;
  try {
    const detail = await fetchSkillDetail(skill.id);
    const md =
      (detail.files ?? []).find((f) => f.path.toLowerCase() === 'skill.md')?.contents ?? '';
    if (!md.trim()) throw new Error('no SKILL.md');
    const enrichment = await enrichWithModel(md, models, undefined, undefined, (f) =>
      process.stderr.write(`\n  model ${f.modelId} failed: ${f.message}\n`),
    );
    modelCats = Array.isArray(enrichment.optional.categories) ? enrichment.optional.categories : [];
    confidence = String(enrichment.optional.confidence ?? 'unknown');
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const goldCats = skill.categories;
  const primaryCorrect = modelCats[0] === goldCats[0];
  const primaryInGold = modelCats.length > 0 && goldCats.includes(modelCats[0]);
  const exact = modelCats.length === goldCats.length && jaccard(modelCats, goldCats) === 1;
  const overlap = jaccard(modelCats, goldCats);
  // needsReview: model couldn't run (rule-based/error) OR primary disagrees with gold.
  const needsReview = confidence !== 'llm' || !primaryCorrect;
  rows.push({
    id: skill.id,
    fuzzy: !!skill.fuzzy,
    confidence,
    error,
    gold: goldCats,
    model: modelCats,
    primaryCorrect,
    primaryInGold,
    exact,
    overlap: Number(overlap.toFixed(3)),
    needsReview,
  });
  process.stderr.write(
    `${confidence} model=[${modelCats.join(', ')}] gold=[${goldCats.join(', ')}] ${primaryCorrect ? 'OK' : 'DIFF'}\n`,
  );
}

const n = rows.length;
const ran = rows.filter((r) => r.confidence === 'llm').length;
const pct = (x) => `${((x / n) * 100).toFixed(1)}%`;
const summary = {
  n,
  modelRan: ran,
  primaryAccuracy: pct(rows.filter((r) => r.primaryCorrect).length),
  primaryInGold: pct(rows.filter((r) => r.primaryInGold).length),
  exactMatch: pct(rows.filter((r) => r.exact).length),
  meanOverlap: Number((rows.reduce((s, r) => s + r.overlap, 0) / n).toFixed(3)),
  needsReview: rows.filter((r) => r.needsReview).length,
  // Same metrics excluding the fuzzy (weak-taxonomy-fit) skills:
  primaryAccuracyNonFuzzy: (() => {
    const nf = rows.filter((r) => !r.fuzzy);
    return nf.length
      ? `${((nf.filter((r) => r.primaryCorrect).length / nf.length) * 100).toFixed(1)}%`
      : 'n/a';
  })(),
};
writeFileSync(outPath, JSON.stringify({ summary, rows }, null, 2));
console.error('\n=== SUMMARY ===');
console.error(JSON.stringify(summary, null, 2));
console.error(`\nfull results: ${outPath}`);
