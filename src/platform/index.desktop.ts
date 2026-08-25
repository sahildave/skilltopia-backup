import { open } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import i18n from '@/i18n/config';
import {
  commands,
  unwrapResult,
  type InstalledScanSnapshot as RustInstalledScanSnapshot,
  type SkillProjectionResult,
} from '@/lib/tauri-bindings';
import {
  installAgentTargetsFromScan,
  InstallCancelledError,
  parseSkillInstallTarget,
  uninstallTargetIds,
} from './install-command';
import { skillEntriesFromScan, providersFromScan } from './scan-utils';
import type {
  BulkCopyStatus,
  CopyProviderResult,
  CopyProviderSkillsResult,
  CopySkillToProvidersResult,
  InstallableSkill,
  InstalledScanSnapshot,
  InstallScope,
  ProjectInfo,
  PlatformPort,
  SkillEntry,
  SkillProvider,
  SkillTargetsResult,
  UninstallOptions,
} from './types';

let cachedScan: InstalledScanSnapshot | null = null;

function normalizeSnapshot(snapshot: RustInstalledScanSnapshot): InstalledScanSnapshot {
  return {
    scannedAt: snapshot.scannedAt,
    source: snapshot.source,
    universal: snapshot.universal,
    providers: snapshot.providers,
    skills: snapshot.skills.map((skill) => ({
      ...skill,
      scope: skill.scope === 'project' ? 'project' : 'global',
      uninstallName: skill.uninstallName,
      paths: skill.paths.map((path) => ({
        path: path.path,
        originalPath: path.originalPath ?? undefined,
      })),
    })),
    warnings: snapshot.warnings.map((warning) => ({
      code: warning.code,
      message: warning.message,
      providerId: warning.providerId ?? undefined,
      path: warning.path ?? undefined,
    })),
  };
}

function normalizeCopyResult(result: {
  results: {
    providerId: string;
    status: CopyProviderResult['status'];
    message?: string | null;
  }[];
}): CopySkillToProvidersResult {
  return {
    results: result.results.map((entry) => ({
      providerId: entry.providerId,
      status: entry.status,
      message: entry.message ?? undefined,
    })),
  };
}

function normalizeBulkCopyResult(result: {
  targets: {
    providerId: string;
    copied: number;
    skipped: number;
    refused: number;
    failed: number;
    issues: { skillName: string; status: BulkCopyStatus; message?: string | null }[];
  }[];
}): CopyProviderSkillsResult {
  return {
    targets: result.targets.map((target) => ({
      ...target,
      issues: target.issues.map((issue) => ({
        skillName: issue.skillName,
        status: issue.status,
        message: issue.message ?? undefined,
      })),
    })),
  };
}

async function ensureScan(): Promise<InstalledScanSnapshot> {
  if (cachedScan) return cachedScan;
  return refreshScan();
}

async function refreshScan(): Promise<InstalledScanSnapshot> {
  const snapshot = normalizeSnapshot(unwrapResult(await commands.scanInstalledSkills()));
  cachedScan = snapshot;
  return snapshot;
}

async function pickProjectDirectory(): Promise<string> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: i18n.t('skills.install.pickProject'),
  });

  if (typeof selected !== 'string' || selected.length === 0) {
    throw new InstallCancelledError('No project folder selected');
  }

  return selected;
}

/**
 * Hand the per-target outcomes to the caller rather than collapsing them into a
 * thrown string. Nothing here aborts the fan-out — that was the old loop's bug,
 * where the first stale provider left every later one installed and skipped the
 * Universal cleanup entirely.
 */
function normalizeProjection(result: SkillProjectionResult): SkillTargetsResult {
  return {
    results: result.results.map((entry) => ({
      providerId: entry.providerId,
      status: entry.status,
      message: entry.message ?? undefined,
    })),
  };
}

async function installSkillToDisk(
  skill: InstallableSkill,
  scope: InstallScope,
): Promise<SkillTargetsResult> {
  const projectPath = scope === 'project' ? await pickProjectDirectory() : null;
  const snapshot = await ensureScan();
  const { source, skillName } = parseSkillInstallTarget(skill.id);
  const result = normalizeProjection(
    unwrapResult(
      await commands.installSkill(
        source,
        skillName,
        installAgentTargetsFromScan(snapshot).providerIds,
        projectPath,
      ),
    ),
  );
  return projectPath ? { ...result, projectPath } : result;
}

async function uninstallSkillFromDisk(
  skillName: string,
  options: UninstallOptions,
): Promise<SkillTargetsResult> {
  return normalizeProjection(
    unwrapResult(await commands.uninstallSkill(skillName, uninstallTargetIds(options))),
  );
}

export const platform: PlatformPort = {
  hasLocalLibrary: true,
  copiesInstallCommand: false,

  getInstalledScan: ensureScan,
  scanInstalled: refreshScan,

  async listProjects(root): Promise<ProjectInfo[]> {
    return unwrapResult(await commands.listProjects(root));
  },

  async scanProject(projectPath) {
    const snapshot = normalizeSnapshot(unwrapResult(await commands.scanProjectSkills(projectPath)));
    return snapshot;
  },

  async pickCodingFolder() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: i18n.t('skills.projects.chooseFolder'),
    });
    return typeof selected === 'string' && selected.length > 0 ? selected : null;
  },

  async revealProviderSkillsDir(providerId) {
    return unwrapResult(await commands.revealProviderSkillsDir(providerId));
  },

  async revealPath(path) {
    return unwrapResult(await commands.revealPath(path));
  },

  async listInstalled(): Promise<SkillEntry[]> {
    return skillEntriesFromScan(await ensureScan());
  },

  async listProviders(): Promise<SkillProvider[]> {
    return providersFromScan(await ensureScan());
  },

  install: installSkillToDisk,

  uninstall: uninstallSkillFromDisk,

  async copySkillToProviders(uninstallName, providerIds) {
    return normalizeCopyResult(
      unwrapResult(await commands.copySkillToProviders(uninstallName, providerIds)),
    );
  },

  async copyProviderSkills(sourceProviderId, skillNames, targetProviderIds) {
    return normalizeBulkCopyResult(
      unwrapResult(
        await commands.copyProviderSkills(sourceProviderId, skillNames, targetProviderIds),
      ),
    );
  },

  async openExternal(url) {
    await openUrl(url);
  },
};
