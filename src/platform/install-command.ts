import type {
  InstallableSkill,
  InstalledScanSnapshot,
  InstallScope,
  UninstallOptions,
} from './types';
import { PROJECT_AGENTS_PROVIDER_ID, UNIVERSAL_PROVIDER_ID } from './types';
import { providerRegistry, universalSkillsDirRelative } from '@/providers';

/** Non-universal detected providers to pass as `-a` flags to `skills add`. */
export interface InstallAgentTargets {
  providerIds: string[];
}

/** Detected non-universal providers that have a global skills directory. */
export function installAgentTargetsFromScan(snapshot: InstalledScanSnapshot): InstallAgentTargets {
  return {
    providerIds: snapshot.providers
      .filter((p) => p.detected && !p.universal && p.skillsDir !== null)
      .map((p) => p.id)
      .sort(),
  };
}

export class InstallCancelledError extends Error {
  constructor(message = 'Install cancelled') {
    super(message);
    this.name = 'InstallCancelledError';
  }
}

/**
 * A catalog entry published from a website rather than a git repository.
 *
 * skills.sh ids come in two shapes: `owner/repo/skill` for GitHub, and
 * `domain.com/skill` for a "well-known" site (see `skillPageUrl` in
 * `api/_lib/skills-catalog.ts`). Acquisition clones git, so the second shape
 * has nothing to clone and cannot be installed — a real gap, not a bad id.
 */
export class UnsupportedSkillSourceError extends Error {
  constructor(readonly host: string) {
    super(`Skill is published from ${host}, which cannot be installed yet`);
    this.name = 'UnsupportedSkillSourceError';
  }
}

export function parseSkillInstallTarget(skillId: string): {
  source: string;
  skillName: string;
} {
  const parts = skillId.split('/').filter(Boolean);
  const host = parts[0];
  if (parts.length === 2 && host) {
    throw new UnsupportedSkillSourceError(host);
  }

  const skillName = parts[parts.length - 1];
  if (parts.length < 3 || !skillName) {
    throw new Error(`Invalid skill id for install (expected owner/repo/skill): ${skillId}`);
  }
  const source = parts.slice(0, -1).join('/');
  return { source, skillName };
}

/** Args for the pasteable `npx` install command. */
function buildSkillsAddArgs(
  skill: InstallableSkill,
  scope: InstallScope,
  targets: InstallAgentTargets = { providerIds: [] },
): string[] {
  const { source, skillName } = parseSkillInstallTarget(skill.id);
  const args = ['--yes', 'skills', 'add', source, '--skill', skillName, '-y'];
  for (const providerId of targets.providerIds) {
    args.push('-a', providerId);
  }
  if (scope === 'global') {
    args.push('-g');
  }
  return args;
}

/**
 * Targets for the in-process uninstall, `universal` included as an ordinary id.
 *
 * An `all` scope with no known provider list means "wherever this landed", so it
 * fans out over the whole registry — the equivalent of the CLI's `-a '*'`, which
 * only cost real time back when each id was its own subprocess.
 */
export function uninstallTargetIds(options: UninstallOptions): string[] {
  if (options.agentScope === 'universal') return [UNIVERSAL_PROVIDER_ID];
  if (options.agentScope !== 'all') return [options.agentScope.providerId];

  const providerIds = options.providerIds
    ? uninstallProviderIds(options)
    : providerRegistry.providers
        .map((provider) => provider.id)
        .filter((id) => id !== UNIVERSAL_PROVIDER_ID);
  return [...providerIds, UNIVERSAL_PROVIDER_ID];
}

/** Args for the pasteable `npx` remove command. */
function buildSkillsRemoveArgs(skillName: string, options: UninstallOptions): string[] {
  const args = ['--yes', 'skills', 'remove', skillName, '-g', '-y'];
  if (options.agentScope === 'all') {
    const providerIds = uninstallProviderIds(options);
    if (providerIds.length > 0) {
      for (const pid of providerIds) {
        args.push('-a', pid);
      }
    } else if (options.providerIds) {
      return args;
    } else {
      args.push('-a', '*');
    }
  } else if (options.agentScope !== 'universal') {
    args.push('-a', options.agentScope.providerId);
  }
  return args;
}

/** Pasteable shell command for web copy-remove UX. */
export function buildSkillsRemoveCommand(skillName: string, options: UninstallOptions): string {
  const cleanupCommand =
    options.agentScope === 'all' ? buildUniversalCleanupCommand(skillName) : null;
  if (options.agentScope === 'all' && options.providerIds && options.providerIds.length > 0) {
    const removeCommands = uninstallProviderIds(options).map((pid) =>
      [
        'npx',
        ...buildSkillsRemoveArgs(skillName, {
          agentScope: { providerId: pid },
        }).map(shellQuoteArg),
      ].join(' '),
    );
    return [...removeCommands, cleanupCommand].filter(Boolean).join(' && ');
  }
  const removeCommand = [
    'npx',
    ...buildSkillsRemoveArgs(skillName, options).map(shellQuoteArg),
  ].join(' ');
  return [removeCommand, cleanupCommand].filter(Boolean).join(' && ');
}

/** Pasteable shell command for web copy-install UX. */
export function buildSkillsInstallCommand(
  skill: InstallableSkill,
  scope: InstallScope,
  targets: InstallAgentTargets = { providerIds: [] },
): string {
  return ['npx', ...buildSkillsAddArgs(skill, scope, targets).map(shellQuoteArg)].join(' ');
}

function shellQuoteArg(arg: string): string {
  if (/^[A-Za-z0-9_./:=@%+-]+$/.test(arg)) return arg;
  return `'${arg.replaceAll("'", `'\\''`)}'`;
}

function buildUniversalCleanupCommand(skillName: string): string {
  if (
    skillName.length === 0 ||
    skillName === '.' ||
    skillName === '..' ||
    skillName.includes('/')
  ) {
    throw new Error('Skill folder name must be a single path segment');
  }
  return `rm -rf ~/${universalSkillsDirRelative(providerRegistry)}/${shellQuoteArg(skillName)}`;
}

function uninstallProviderIds(options: UninstallOptions): string[] {
  return (options.providerIds ?? []).filter(
    (id) => id !== UNIVERSAL_PROVIDER_ID && id !== PROJECT_AGENTS_PROVIDER_ID,
  );
}
