import { open } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Command } from '@tauri-apps/plugin-shell';
import i18n from '@/i18n/config';
import {
  commands,
  unwrapResult,
  type InstalledScanSnapshot as RustInstalledScanSnapshot,
} from '@/lib/tauri-bindings';
import {
  buildSkillsAddArgs,
  buildSkillsRemoveArgs,
  installAgentTargetsFromScan,
  InstallCancelledError,
} from './install-command';
import { skillEntriesFromScan, providersFromScan } from './scan-utils';
import { UNIVERSAL_PROVIDER_ID } from './types';
import type {
  CopyProviderResult,
  CopySkillToProvidersResult,
  InstallableSkill,
  InstalledScanSnapshot,
  InstallScope,
  ProjectInfo,
  PlatformPort,
  SkillEntry,
  SkillProvider,
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

async function installSkillToDisk(skill: InstallableSkill, scope: InstallScope): Promise<void> {
  const cwd = scope === 'project' ? await pickProjectDirectory() : undefined;
  const snapshot = await ensureScan();
  const args = buildSkillsAddArgs(skill, scope, installAgentTargetsFromScan(snapshot));
  const output = await Command.create('npx', args, cwd ? { cwd } : undefined).execute();

  if (output.code !== 0) {
    const detail = [output.stderr, output.stdout]
      .map((part) => part.trim())
      .filter(Boolean)
      .join('\n');
    throw new Error(detail || `Skill install failed (exit ${String(output.code ?? 'unknown')})`);
  }
}

async function uninstallSkillFromDisk(skillName: string, options: UninstallOptions): Promise<void> {
  if (options.agentScope === 'all' && options.providerIds && options.providerIds.length > 0) {
    const providerIds = options.providerIds.filter(
      (providerId) => providerId !== UNIVERSAL_PROVIDER_ID,
    );
    for (const providerId of providerIds) {
      const args = buildSkillsRemoveArgs(skillName, {
        agentScope: { providerId },
      });
      const output = await Command.create('npx', args).execute();
      if (output.code !== 0) {
        const detail = [output.stderr, output.stdout]
          .map((part) => part.trim())
          .filter(Boolean)
          .join('\n');
        throw new Error(
          detail ||
            `Skill uninstall failed for ${providerId} (exit ${String(output.code ?? 'unknown')})`,
        );
      }
    }
    unwrapResult(await commands.deleteUniversalSkill(skillName));
    return;
  }

  const args = buildSkillsRemoveArgs(skillName, options);
  const output = await Command.create('npx', args).execute();

  if (output.code !== 0) {
    const detail = [output.stderr, output.stdout]
      .map((part) => part.trim())
      .filter(Boolean)
      .join('\n');
    throw new Error(detail || `Skill uninstall failed (exit ${String(output.code ?? 'unknown')})`);
  }

  if (options.agentScope === 'all') {
    unwrapResult(await commands.deleteUniversalSkill(skillName));
  }
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

  async openExternal(url) {
    await openUrl(url);
  },
};
