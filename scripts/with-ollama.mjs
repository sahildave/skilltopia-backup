#!/usr/bin/env node
/**
 * Point the enrichment classifier at a local Ollama model, then run the given
 * command with the overrides in place.
 *
 *   node scripts/with-ollama.mjs <command> [args...]
 *
 * Why a wrapper rather than inline env vars: `infisical run --env=dev` injects
 * its own `ENRICHMENT_MODEL_CHAIN` (the hosted groq/gemini chain) into the
 * process, clobbering any value exported in the shell before it. Setting the
 * overrides HERE — after Infisical has injected, in the child we spawn — is the
 * only way they win. The `openai/` provider also needs a non-empty
 * `OPENAI_API_KEY` or `createModelsFromEnv` resolves zero models and silently
 * falls back to rule-based; Ollama ignores the value.
 *
 * Knobs (all optional):
 *   OLLAMA_MODEL     model tag         (default: qwen2.5:7b)
 *   OLLAMA_CHAIN     full chain string, overrides OLLAMA_MODEL if set
 *   OLLAMA_BASE_URL  OpenAI-compat URL (default: http://localhost:11434/v1)
 *
 * Default is qwen2.5:7b (a non-reasoning instruct model): ~6x faster than the
 * reasoning qwen3:14b, which burns a long hidden thinking pass on every call
 * for no gain on bounded classification. Override with OLLAMA_MODEL to compare.
 */
import { spawn } from 'node:child_process';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('usage: with-ollama.mjs <command> [args...]');
  process.exit(2);
}

const model = process.env.OLLAMA_MODEL?.trim() || 'qwen2.5:7b';
const chain = process.env.OLLAMA_CHAIN?.trim() || `openai/${model}`;
const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || 'http://localhost:11434/v1';
const apiKey = process.env.OPENAI_API_KEY?.trim() || 'ollama';

console.error(`[ollama] routing enrichment via ${chain} @ ${baseUrl}`);

const child = spawn(command, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    ENRICHMENT_MODEL_CHAIN: chain,
    OPENAI_BASE_URL: baseUrl,
    OPENAI_API_KEY: apiKey,
  },
});
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
