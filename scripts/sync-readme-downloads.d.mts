export const DOWNLOADS_START: string;
export const DOWNLOADS_END: string;

export interface ClassifiedReleaseAssets {
  appleSiliconDmg: string | undefined;
  intelMacDmg: string | undefined;
  windowsInstaller: string | undefined;
  linuxAppImage: string | undefined;
}

export function parseGithubRepoSlug(remoteUrl: string): string | null;

export function classifyReleaseAssets(assetNames: string[]): ClassifiedReleaseAssets;

export function buildDownloadsMarkdown(
  assets: ClassifiedReleaseAssets,
  urls: { downloadBase: string; releasesLatest: string },
): string;

export function buildDownloadsNote(assets: ClassifiedReleaseAssets): string;

export function replaceDownloadsSection(
  readme: string,
  downloadsBlock: string,
  note: string,
): string;
