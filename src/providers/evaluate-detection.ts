import { homedir } from 'node:os';
import { join } from 'node:path';
import type {
  DetectionRule,
  GlobalSkillsDir,
  PathSpec,
  ProviderPlatform,
  SpecialProbeName,
} from './types';

export interface ProbeFs {
  pathExists: (path: string) => boolean;
  readFile: (path: string) => string;
}

export interface ProbeContext {
  home: string;
  cwd: string;
  platform: ProviderPlatform;
  env: Record<string, string | undefined>;
  fs: ProbeFs;
}

export function createProbeContext(
  overrides: Partial<Omit<ProbeContext, 'fs'>> & {
    fs?: Partial<ProbeFs>;
  } = {},
): ProbeContext {
  return {
    home: overrides.home ?? homedir(),
    cwd: overrides.cwd ?? process.cwd(),
    platform: overrides.platform ?? (process.platform as ProviderPlatform),
    env: overrides.env ?? { ...process.env },
    fs: {
      pathExists: overrides.fs?.pathExists ?? (() => false),
      readFile:
        overrides.fs?.readFile ??
        (() => {
          throw new Error('readFile not configured');
        }),
    },
  };
}

function configHome(ctx: ProbeContext): string {
  const xdg = ctx.env.XDG_CONFIG_HOME?.trim();
  return xdg && xdg.length > 0 ? xdg : join(ctx.home, '.config');
}

function envHome(ctx: ProbeContext, env: string, defaultPath: string): string {
  const value = ctx.env[env]?.trim();
  return value && value.length > 0 ? value : join(ctx.home, defaultPath);
}

export function resolvePathSpec(spec: PathSpec, ctx: ProbeContext): string | null {
  if (spec.base === 'home') return join(ctx.home, spec.path);
  if (spec.base === 'configHome') return join(configHome(ctx), spec.path);
  if (spec.base === 'cwd') return join(ctx.cwd, spec.path);
  if (spec.base === 'absolute') {
    if (spec.platforms && !spec.platforms.includes(ctx.platform)) return null;
    return spec.path;
  }
  if (spec.base === 'envHome') {
    const root = envHome(ctx, spec.env, spec.defaultPath);
    return spec.path ? join(root, spec.path) : root;
  }
  if (spec.base === 'env') {
    if (spec.platforms && !spec.platforms.includes(ctx.platform)) return null;
    const value = ctx.env[spec.env]?.trim();
    if (!value) return null;
    return join(value, spec.path);
  }
  return null;
}

function packageJsonHasDependency(
  packageJsonPath: string,
  dependencyName: string,
  ctx: ProbeContext,
): boolean {
  try {
    const packageJson = JSON.parse(ctx.fs.readFile(packageJsonPath)) as {
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
    };
    return !!(
      packageJson.dependencies?.[dependencyName] || packageJson.devDependencies?.[dependencyName]
    );
  } catch {
    return false;
  }
}

/**
 * OpenClaw global skills dir: prefer `.openclaw`, then legacy homes, else default.
 * Mirrors upstream `getOpenClawGlobalSkillsDir`.
 */
export function resolveOpenClawGlobalSkillsDir(ctx: ProbeContext): string {
  if (ctx.fs.pathExists(join(ctx.home, '.openclaw'))) {
    return join(ctx.home, '.openclaw/skills');
  }
  if (ctx.fs.pathExists(join(ctx.home, '.clawdbot'))) {
    return join(ctx.home, '.clawdbot/skills');
  }
  if (ctx.fs.pathExists(join(ctx.home, '.moltbot'))) {
    return join(ctx.home, '.moltbot/skills');
  }
  return join(ctx.home, '.openclaw/skills');
}

export function evaluateSpecialProbe(name: SpecialProbeName, ctx: ProbeContext): boolean {
  if (name === 'eve-installed') {
    const agentDir = join(ctx.cwd, 'agent');
    const packageJsonPath = join(ctx.cwd, 'package.json');
    return ctx.fs.pathExists(agentDir) && packageJsonHasDependency(packageJsonPath, 'eve', ctx);
  }
  if (name === 'openclaw-skills-dir') {
    // Detection uses ordinary path probes; this name is for skills-dir only.
    return false;
  }
  return false;
}

export function evaluateDetection(rule: DetectionRule, ctx: ProbeContext): boolean {
  if (rule.type === 'never') return false;
  if (rule.type === 'special') return evaluateSpecialProbe(rule.name, ctx);
  const results = rule.paths.map((spec) => {
    const resolved = resolvePathSpec(spec, ctx);
    return resolved !== null && ctx.fs.pathExists(resolved);
  });
  return rule.match === 'all' ? results.every(Boolean) : results.some(Boolean);
}

export function resolveGlobalSkillsDir(dir: GlobalSkillsDir, ctx: ProbeContext): string | null {
  if (dir.type === 'none') return null;
  if (dir.type === 'special' && dir.name === 'openclaw-skills-dir') {
    return resolveOpenClawGlobalSkillsDir(ctx);
  }
  if (dir.type === 'path') return resolvePathSpec(dir.path, ctx);
  return null;
}
