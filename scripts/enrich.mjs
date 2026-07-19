import {
  runLocalEnrichment,
  runEnrichmentSync,
} from '../api/_lib/enrichment-pipeline.ts'

const mode = process.argv.includes('--sync') ? 'sync' : 'seed'
const result =
  mode === 'sync' ? await runEnrichmentSync({}) : await runLocalEnrichment({})

console.log(JSON.stringify({ mode, ...result }, null, 2))
if (result.failed.length > 0) process.exitCode = 1
