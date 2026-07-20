import type {
  InstallableSkill,
  InstalledScanSnapshot,
  InstallScope,
  UninstallAgentScope,
} from './types'

/** Non-universal detected providers to pass as `-a` flags to `skills add`. */
export type InstallAgentTargets = {
  providerIds: string[]
}

/** Detected non-universal providers that have a global skills directory. */
export function installAgentTargetsFromScan(
  snapshot: InstalledScanSnapshot
): InstallAgentTargets {
  return {
    providerIds: snapshot.providers
      .filter(p => p.detected && !p.universal && p.skillsDir !== null)
      .map(p => p.id)
      .sort(),
  }
}

export class InstallCancelledError extends Error {
  constructor(message = 'Install cancelled') {
    super(message)
    this.name = 'InstallCancelledError'
  }
}

export function parseSkillInstallTarget(skillId: string): {
  source: string
  skillName: string
} {
  const parts = skillId.split('/').filter(Boolean)
  if (parts.length < 3) {
    throw new Error(
      `Invalid skill id for install (expected owner/repo/skill): ${skillId}`
    )
  }

  const skillName = parts[parts.length - 1]
  if (!skillName) {
    throw new Error(
      `Invalid skill id for install (expected owner/repo/skill): ${skillId}`
    )
  }
  const source = parts.slice(0, -1).join('/')
  return { source, skillName }
}

/** Args for `npx` — non-interactive skills CLI install. */
export function buildSkillsAddArgs(
  skill: InstallableSkill,
  scope: InstallScope,
  targets: InstallAgentTargets = { providerIds: [] }
): string[] {
  const { source, skillName } = parseSkillInstallTarget(skill.id)
  const args = [
    '--yes',
    'skills',
    'add',
    source,
    '--skill',
    skillName,
    '-y',
  ]
  for (const providerId of targets.providerIds) {
    args.push('-a', providerId)
  }
  if (scope === 'global') {
    args.push('-g')
  }
  return args
}

/** Args for `npx` — non-interactive skills CLI remove. */
export function buildSkillsRemoveArgs(
  skillName: string,
  agentScope: UninstallAgentScope
): string[] {
  const args = ['--yes', 'skills', 'remove', skillName, '-g', '-y']
  if (agentScope === 'all') {
    args.push('-a', '*')
  } else if (agentScope !== 'universal') {
    args.push('-a', agentScope.providerId)
  }
  return args
}

/** Pasteable shell command for web copy-remove UX. */
export function buildSkillsRemoveCommand(
  skillName: string,
  agentScope: UninstallAgentScope
): string {
  return [
    'npx',
    ...buildSkillsRemoveArgs(skillName, agentScope).map(shellQuoteArg),
  ].join(' ')
}

/** Pasteable shell command for web copy-install UX. */
export function buildSkillsInstallCommand(
  skill: InstallableSkill,
  scope: InstallScope,
  targets: InstallAgentTargets = { providerIds: [] }
): string {
  return [
    'npx',
    ...buildSkillsAddArgs(skill, scope, targets).map(shellQuoteArg),
  ].join(' ')
}

function shellQuoteArg(arg: string): string {
  if (/^[A-Za-z0-9_./:=@%+-]+$/.test(arg)) return arg
  return `'${arg.replaceAll("'", `'\\''`)}'`
}
