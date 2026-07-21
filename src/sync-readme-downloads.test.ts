import { describe, expect, it } from 'vitest';
import {
  DOWNLOADS_END,
  DOWNLOADS_START,
  buildDownloadsMarkdown,
  buildDownloadsNote,
  classifyReleaseAssets,
  parseGithubRepoSlug,
  replaceDownloadsSection,
} from '../scripts/sync-readme-downloads.mjs';

describe('sync-readme-downloads', () => {
  it('parses github remote urls', () => {
    expect(parseGithubRepoSlug('https://github.com/sahildave/skilltopia.git')).toBe(
      'sahildave/skilltopia',
    );
    expect(parseGithubRepoSlug('git@github.com:sahildave/skilltopia.git')).toBe(
      'sahildave/skilltopia',
    );
    expect(parseGithubRepoSlug('https://example.com/not-github')).toBeNull();
  });

  it('classifies published installer assets and ignores signatures', () => {
    const assets = classifyReleaseAssets([
      'latest.json',
      'skilltopia_0.2.0_aarch64.app.tar.gz',
      'skilltopia_0.2.0_aarch64.app.tar.gz.sig',
      'skilltopia_0.2.0_aarch64.dmg',
      'skilltopia_0.2.0_amd64.AppImage',
      'skilltopia_0.2.0_amd64.AppImage.sig',
      'skilltopia_0.2.0_x64_en-US.msi',
    ]);

    expect(assets).toEqual({
      appleSiliconDmg: 'skilltopia_0.2.0_aarch64.dmg',
      intelMacDmg: undefined,
      windowsInstaller: 'skilltopia_0.2.0_x64_en-US.msi',
      linuxAppImage: 'skilltopia_0.2.0_amd64.AppImage',
    });
  });

  it('builds direct download links when assets exist', () => {
    const markdown = buildDownloadsMarkdown(
      {
        appleSiliconDmg: 'skilltopia_0.2.0_aarch64.dmg',
        intelMacDmg: undefined,
        windowsInstaller: undefined,
        linuxAppImage: 'skilltopia_0.2.0_amd64.AppImage',
      },
      {
        downloadBase: 'https://github.com/sahildave/skilltopia/releases/latest/download',
        releasesLatest: 'https://github.com/sahildave/skilltopia/releases/latest',
      },
    );

    expect(markdown).toBe(`${DOWNLOADS_START}
- [Apple Silicon macOS (.dmg)](https://github.com/sahildave/skilltopia/releases/latest/download/skilltopia_0.2.0_aarch64.dmg)
- [Intel macOS](https://github.com/sahildave/skilltopia/releases/latest)
- [Windows](https://github.com/sahildave/skilltopia/releases/latest)
- [Linux (.AppImage)](https://github.com/sahildave/skilltopia/releases/latest/download/skilltopia_0.2.0_amd64.AppImage)
${DOWNLOADS_END}`);
  });

  it('describes which platforms are direct vs fallback', () => {
    expect(
      buildDownloadsNote({
        appleSiliconDmg: 'a.dmg',
        intelMacDmg: undefined,
        windowsInstaller: undefined,
        linuxAppImage: 'a.AppImage',
      }),
    ).toBe(
      'Apple Silicon and Linux links point straight to the latest published asset and should start downloading immediately. Intel macOS and Windows currently fall back to the latest release page until those bundle assets are attached there.',
    );
  });

  it('replaces the marked downloads block and following note', () => {
    const readme = `# Skilltopia

## Downloads

${DOWNLOADS_START}
- old
${DOWNLOADS_END}

Old note.

## Stack
`;

    const next = replaceDownloadsSection(
      readme,
      `${DOWNLOADS_START}
- new
${DOWNLOADS_END}`,
      'New note.',
    );

    expect(next).toBe(`# Skilltopia

## Downloads

${DOWNLOADS_START}
- new
${DOWNLOADS_END}

New note.

## Stack
`);
  });
});
