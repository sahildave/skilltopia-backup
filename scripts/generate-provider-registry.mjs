/**
 * Generate the checked-in provider registry from upstream vercel-labs/skills
 * `src/agents.ts`. Do not import or execute upstream TypeScript at app runtime.
 *
 * Usage:
 *   node scripts/generate-provider-registry.mjs
 *   node scripts/generate-provider-registry.mjs --commit <sha>
 *   node scripts/generate-provider-registry.mjs --input path/to/agents.ts --commit <sha>
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SOURCE_REPO = 'https://github.com/vercel-labs/skills';
const AGENTS_PATH = 'src/agents.ts';
const OUTPUT_PATH = resolve('src/providers/registry.json');
const VENDORED_AGENTS_PATH = resolve('src/providers/upstream/agents.ts');
const ATTRIBUTION =
  'Provider definitions derived from vercel-labs/skills (MIT). See source.repositoryUrl and source.commit.';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function fail(message) {
  throw new Error(message);
}

function getStringLiteral(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function getBooleanLiteral(node) {
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  return null;
}

/**
 * Parameter aliases active while inlining a detection helper, e.g. upstream's
 * `isKimchiInstalled(homeDir = home, pathExists = existsSync)` binds
 * homeDir→home and pathExists→existsSync inside that helper's body.
 * @type {Map<string, string>}
 */
let identAliases = new Map();

/** Identifier text with any active helper-parameter alias applied. */
function resolvedName(node) {
  if (!ts.isIdentifier(node)) return null;
  return identAliases.get(node.text) ?? node.text;
}

function isIdentifierNamed(node, name) {
  return resolvedName(node) === name;
}

function isPropertyAccess(node, objectName, name) {
  return (
    ts.isPropertyAccessExpression(node) &&
    isIdentifierNamed(node.expression, objectName) &&
    node.name.text === name
  );
}

function unwrapExpression(node) {
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    node = node.expression;
  }
  return node;
}

/**
 * Home-directory aliases declared at the top of upstream `agents.ts`, derived
 * per parse rather than hardcoded — upstream adds one per new agent, and a
 * hardcoded list made every such addition a build break.
 *
 * Recognised shapes:
 *   const xHome = process.env.X_HOME?.trim() || join(home, '.x');  → envHome
 *   const xHome = process.env.X?.trim();                           → env (optional)
 *
 * @type {Map<string, {env: string, defaultPath?: string, optional?: boolean}>}
 */
let homeAliases = new Map();

/** `process.env.NAME?.trim()` → "NAME", else null. */
function getTrimmedEnvRead(node) {
  node = unwrapExpression(node);
  if (!ts.isCallExpression(node)) return null;
  const callee = unwrapExpression(node.expression);
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== 'trim') return null;
  const target = unwrapExpression(callee.expression);
  if (!ts.isPropertyAccessExpression(target)) return null;
  if (!isPropertyAccess(target.expression, 'process', 'env')) return null;
  return target.name.text;
}

/**
 * Zero-arg detection helpers upstream factors out of `detectInstalled`, e.g.
 *   export function isKimchiInstalled(homeDir = home, pathExists = existsSync) {
 *     return pathExists(join(homeDir, '.config', 'kimchi'));
 *   }
 * Recorded so a `return isKimchiInstalled()` call site can be inlined.
 * @type {Map<string, {expression: object, aliases: Map<string, string>}>}
 */
let detectionHelpers = new Map();

function collectDetectionHelpers(sourceFile) {
  const helpers = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.name || !statement.body) continue;

    // Every parameter must have a plain identifier default, so a zero-arg call
    // is fully determined by the defaults.
    const aliases = new Map();
    let usable = true;
    for (const param of statement.parameters) {
      if (!ts.isIdentifier(param.name) || !param.initializer) {
        usable = false;
        break;
      }
      const init = unwrapExpression(param.initializer);
      if (!ts.isIdentifier(init)) {
        usable = false;
        break;
      }
      aliases.set(param.name.text, init.text);
    }
    if (!usable) continue;

    const statements = statement.body.statements;
    if (statements.length !== 1) continue;
    const only = statements[0];
    if (!ts.isReturnStatement(only) || !only.expression) continue;

    helpers.set(statement.name.text, { expression: only.expression, aliases });
  }
  return helpers;
}

function collectHomeAliases(sourceFile) {
  const aliases = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      const init = unwrapExpression(decl.initializer);

      // const x = process.env.X?.trim() || join(home, '.x')
      if (ts.isBinaryExpression(init) && init.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
        const env = getTrimmedEnvRead(init.left);
        const fallback = unwrapExpression(init.right);
        if (
          env &&
          ts.isCallExpression(fallback) &&
          isIdentifierNamed(fallback.expression, 'join') &&
          fallback.arguments.length === 2 &&
          isIdentifierNamed(unwrapExpression(fallback.arguments[0]), 'home')
        ) {
          const defaultPath = getStringLiteral(unwrapExpression(fallback.arguments[1]));
          if (defaultPath !== null) aliases.set(decl.name.text, { env, defaultPath });
        }
        continue;
      }

      // const x = process.env.X?.trim()
      const env = getTrimmedEnvRead(init);
      if (env) aliases.set(decl.name.text, { env, optional: true });
    }
  }
  return aliases;
}

/**
 * Parse path expressions used in globalSkillsDir / existsSync(join(...)).
 * @returns {object|null}
 */
function parsePathExpression(node, cwdAliases = new Set()) {
  node = unwrapExpression(node);

  if (ts.isCallExpression(node) && isIdentifierNamed(node.expression, 'join')) {
    const args = [...node.arguments];
    if (args.length < 2) return null;
    const root = unwrapExpression(args[0]);
    const segments = args.slice(1).map((arg) => getStringLiteral(unwrapExpression(arg)));
    if (segments.some((s) => s === null)) return null;
    const path = segments.join('/');

    if (isIdentifierNamed(root, 'home')) {
      return { base: 'home', path };
    }
    if (isIdentifierNamed(root, 'configHome')) {
      return { base: 'configHome', path };
    }
    if (
      (ts.isCallExpression(root) && isPropertyAccess(root.expression, 'process', 'cwd')) ||
      (ts.isIdentifier(root) && cwdAliases.has(root.text))
    ) {
      return { base: 'cwd', path };
    }
    if (ts.isIdentifier(root)) {
      const alias = homeAliases.get(resolvedName(root));
      if (alias) {
        return alias.optional
          ? { base: 'env', env: alias.env, path, optional: true }
          : {
              base: 'envHome',
              env: alias.env,
              defaultPath: alias.defaultPath,
              ...(path ? { path } : {}),
            };
      }
    }
    return null;
  }

  if (ts.isIdentifier(node)) {
    const alias = homeAliases.get(resolvedName(node));
    if (alias && !alias.optional) {
      return { base: 'envHome', env: alias.env, defaultPath: alias.defaultPath };
    }
  }

  const absolute = getStringLiteral(node);
  if (absolute !== null && absolute.startsWith('/')) {
    return { base: 'absolute', path: absolute };
  }

  return null;
}

function parseExistsSyncArg(node, cwdAliases = new Set()) {
  node = unwrapExpression(node);
  if (!ts.isCallExpression(node)) return null;
  if (!isIdentifierNamed(node.expression, 'existsSync')) return null;
  if (node.arguments.length !== 1) return null;
  return parsePathExpression(node.arguments[0], cwdAliases);
}

function flattenBinaryOr(node, acc = []) {
  node = unwrapExpression(node);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
    flattenBinaryOr(node.left, acc);
    flattenBinaryOr(node.right, acc);
    return acc;
  }
  acc.push(node);
  return acc;
}

function flattenBinaryAnd(node, acc = []) {
  node = unwrapExpression(node);
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
  ) {
    flattenBinaryAnd(node.left, acc);
    flattenBinaryAnd(node.right, acc);
    return acc;
  }
  acc.push(node);
  return acc;
}

function parseOptionalEnvExists(node, cwdAliases = new Set()) {
  // !!zedAppDataHome && existsSync(join(zedAppDataHome, 'Zed'))
  node = unwrapExpression(node);
  if (
    !ts.isBinaryExpression(node) ||
    node.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken
  ) {
    return null;
  }
  const left = unwrapExpression(node.left);
  const right = unwrapExpression(node.right);
  const path = parseExistsSyncArg(right, cwdAliases);
  if (!path) return null;

  const isBangBang =
    ts.isPrefixUnaryExpression(left) &&
    left.operator === ts.SyntaxKind.ExclamationToken &&
    ts.isPrefixUnaryExpression(left.operand) &&
    left.operand.operator === ts.SyntaxKind.ExclamationToken;

  if (isBangBang) {
    const ident = unwrapExpression(left.operand.operand);
    if (
      isIdentifierNamed(ident, 'zedAppDataHome') ||
      isIdentifierNamed(ident, 'zedFlatpakConfigHome')
    ) {
      return path;
    }
  }
  return null;
}

function parseDetectionExpression(node, agentId, cwdAliases = new Set()) {
  node = unwrapExpression(node);

  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return { type: 'never' };
  }

  if (ts.isCallExpression(node) && isIdentifierNamed(node.expression, 'isZCodeInstalled')) {
    return {
      type: 'paths',
      match: 'any',
      paths: [
        { base: 'home', path: '.zcode' },
        { base: 'absolute', path: '/Applications/ZCode.app' },
      ],
    };
  }

  if (
    ts.isCallExpression(node) &&
    isIdentifierNamed(node.expression, 'getOpenClawGlobalSkillsDir')
  ) {
    fail(`${agentId}: unexpected getOpenClawGlobalSkillsDir in detection`);
  }

  // eve: existsSync(join(cwd, 'agent')) && packageJsonHasDependency(...)
  const andParts = flattenBinaryAnd(node);
  if (andParts.length > 1) {
    const hasPackageDep = andParts.some(
      (part) =>
        ts.isCallExpression(unwrapExpression(part)) &&
        isIdentifierNamed(unwrapExpression(part).expression, 'packageJsonHasDependency'),
    );
    if (hasPackageDep) {
      return { type: 'special', name: 'eve-installed' };
    }
    const paths = andParts.map((part) => {
      const path = parseExistsSyncArg(part, cwdAliases);
      if (!path) fail(`${agentId}: unsupported AND detection term: ${part.getText()}`);
      return path;
    });
    return { type: 'paths', match: 'all', paths };
  }

  const orParts = flattenBinaryOr(node);
  if (orParts.length > 1) {
    const paths = orParts.map((part) => {
      const optional = parseOptionalEnvExists(part, cwdAliases);
      if (optional) return optional;
      const path = parseExistsSyncArg(part, cwdAliases);
      if (!path) fail(`${agentId}: unsupported OR detection term: ${part.getText()}`);
      return path;
    });
    return { type: 'paths', match: 'any', paths };
  }

  const single = parseExistsSyncArg(node, cwdAliases);
  if (single) return { type: 'paths', match: 'any', paths: [single] };

  if (
    ts.isCallExpression(node) &&
    node.arguments.length === 0 &&
    ts.isIdentifier(node.expression)
  ) {
    const helper = detectionHelpers.get(node.expression.text);
    if (helper) {
      const outer = identAliases;
      identAliases = helper.aliases;
      try {
        return parseDetectionExpression(helper.expression, agentId, cwdAliases);
      } finally {
        identAliases = outer;
      }
    }
  }

  fail(`${agentId}: unsupported detectInstalled expression: ${node.getText()}`);
}

function getDetectInstalledBody(method) {
  const init = method.initializer;
  if (!init || !ts.isArrowFunction(init)) {
    fail('detectInstalled must be an async arrow function');
  }
  if (init.body && !ts.isBlock(init.body)) {
    return { expression: init.body, cwdAliases: new Set() };
  }
  if (!init.body || !ts.isBlock(init.body)) {
    fail('detectInstalled missing body');
  }

  const cwdAliases = new Set();
  let expression = null;
  for (const statement of init.body.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.initializer &&
          ts.isCallExpression(unwrapExpression(decl.initializer)) &&
          isPropertyAccess(unwrapExpression(decl.initializer).expression, 'process', 'cwd')
        ) {
          cwdAliases.add(decl.name.text);
          continue;
        }
        fail(`detectInstalled unsupported local: ${statement.getText()}`);
      }
      continue;
    }
    if (ts.isReturnStatement(statement) && statement.expression) {
      expression = statement.expression;
      continue;
    }
    fail(`detectInstalled unsupported statement: ${statement.getText()}`);
  }
  if (!expression) fail('detectInstalled return missing expression');
  return { expression, cwdAliases };
}

function parseGlobalSkillsDir(node, agentId) {
  node = unwrapExpression(node);
  if (node.kind === ts.SyntaxKind.UndefinedKeyword || isIdentifierNamed(node, 'undefined')) {
    return { type: 'none' };
  }
  if (
    ts.isCallExpression(node) &&
    isIdentifierNamed(node.expression, 'getOpenClawGlobalSkillsDir')
  ) {
    return { type: 'special', name: 'openclaw-skills-dir' };
  }
  const path = parsePathExpression(node);
  if (!path) fail(`${agentId}: unsupported globalSkillsDir: ${node.getText()}`);
  return { type: 'path', path };
}

function parseAgentConfig(id, objectLiteral) {
  if (!ts.isObjectLiteralExpression(objectLiteral)) {
    fail(`Agent ${id}: expected object literal`);
  }

  /** @type {Record<string, import('typescript').ObjectLiteralElementLike>} */
  const props = {};
  for (const prop of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
      fail(`Agent ${id}: unsupported property shape`);
    }
    props[prop.name.text] = prop;
  }

  const nameProp = props.name;
  const displayNameProp = props.displayName;
  const skillsDirProp = props.skillsDir;
  const globalSkillsDirProp = props.globalSkillsDir;
  const detectProp = props.detectInstalled;

  if (!nameProp || !displayNameProp || !skillsDirProp || !globalSkillsDirProp || !detectProp) {
    fail(`Agent ${id}: missing required fields`);
  }

  const name = getStringLiteral(nameProp.initializer);
  const displayName = getStringLiteral(displayNameProp.initializer);
  const skillsDir = getStringLiteral(skillsDirProp.initializer);
  if (name === null || displayName === null || skillsDir === null) {
    fail(`Agent ${id}: name/displayName/skillsDir must be string literals`);
  }
  if (name !== id) fail(`Agent ${id}: name field mismatch (${name})`);

  let showInUniversalList = true;
  if (props.showInUniversalList) {
    const value = getBooleanLiteral(props.showInUniversalList.initializer);
    if (value === null) fail(`Agent ${id}: showInUniversalList must be boolean`);
    showInUniversalList = value;
  }

  let showInUniversalPrompt = true;
  if (props.showInUniversalPrompt) {
    const value = getBooleanLiteral(props.showInUniversalPrompt.initializer);
    if (value === null) fail(`Agent ${id}: showInUniversalPrompt must be boolean`);
    showInUniversalPrompt = value;
  }

  const { expression, cwdAliases } = getDetectInstalledBody(detectProp);

  return {
    id,
    displayName,
    skillsDir,
    universal: skillsDir === '.agents/skills',
    showInUniversalList,
    showInUniversalPrompt,
    globalSkillsDir: parseGlobalSkillsDir(globalSkillsDirProp.initializer, id),
    detection: parseDetectionExpression(expression, id, cwdAliases),
  };
}

function findAgentsObject(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === 'agents' && decl.initializer) {
        return unwrapExpression(decl.initializer);
      }
    }
  }
  fail('Could not find `agents` declaration in upstream agents.ts');
}

export function parseAgentsSource(sourceText, fileName = 'agents.ts') {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  homeAliases = collectHomeAliases(sourceFile);
  detectionHelpers = collectDetectionHelpers(sourceFile);
  const agentsObject = findAgentsObject(sourceFile);
  if (!ts.isObjectLiteralExpression(agentsObject)) {
    fail('`agents` must be an object literal');
  }

  const providers = [];
  for (const prop of agentsObject.properties) {
    if (!ts.isPropertyAssignment(prop)) {
      fail(`Unsupported agents entry: ${prop.getText()}`);
    }
    const id = ts.isIdentifier(prop.name) ? prop.name.text : getStringLiteral(prop.name);
    if (!id) fail('Agent key must be an identifier or string literal');
    providers.push(parseAgentConfig(id, prop.initializer));
  }

  providers.sort((a, b) => a.id.localeCompare(b.id));
  return providers;
}

async function resolveCommitSha(explicit) {
  if (explicit) return explicit;
  const response = await fetch('https://api.github.com/repos/vercel-labs/skills/commits/main', {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) {
    fail(`Failed to resolve upstream commit: ${response.status}`);
  }
  const data = await response.json();
  return data.sha;
}

function stripVendoredHeader(sourceText) {
  if (!sourceText.startsWith('/**')) return sourceText;
  const end = sourceText.indexOf('*/');
  if (end === -1) return sourceText;
  return sourceText.slice(end + 2).replace(/^\r?\n/, '');
}

async function loadAgentsSource(commit) {
  const inputPath = argValue('--input');
  if (inputPath) {
    return stripVendoredHeader(await readFile(resolve(inputPath), 'utf8'));
  }
  const url = `https://raw.githubusercontent.com/vercel-labs/skills/${commit}/${AGENTS_PATH}`;
  const response = await fetch(url);
  if (!response.ok) {
    fail(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

export function buildRegistry(providers, commit) {
  return {
    source: {
      repositoryUrl: SOURCE_REPO,
      commit,
      license: 'MIT',
      attribution: ATTRIBUTION,
      agentsTsPath: AGENTS_PATH,
    },
    providers,
  };
}

async function main() {
  const commit = await resolveCommitSha(argValue('--commit'));
  const sourceText = await loadAgentsSource(commit);
  const providers = parseAgentsSource(sourceText);
  const registry = buildRegistry(providers, commit);
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(registry, null, 2)}\n`);
  await mkdir(dirname(VENDORED_AGENTS_PATH), { recursive: true });
  const vendored = `/**\n * Vendored from ${SOURCE_REPO}/blob/${commit}/${AGENTS_PATH}\n * MIT License — do not edit by hand; regenerate via scripts/generate-provider-registry.mjs\n */\n${sourceText}`;
  await writeFile(VENDORED_AGENTS_PATH, vendored);
  console.log(
    `Wrote ${providers.length} providers → ${OUTPUT_PATH} (commit ${commit.slice(0, 7)})`,
  );
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
