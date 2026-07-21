import { describe, expect, it } from 'vitest';
import { validateUpdaterReleaseConfig } from '../scripts/release-config.mjs';

describe('updater release config guard', () => {
  it('rejects an active updater with a placeholder public key', () => {
    const errors = validateUpdaterReleaseConfig({
      bundle: {
        createUpdaterArtifacts: true,
      },
      plugins: {
        updater: {
          active: true,
          endpoints: [
            'https://github.com/sahildave/skilltopia/releases/latest/download/latest.json',
          ],
          pubkey: 'YOUR_UPDATER_PUBLIC_KEY_HERE',
        },
      },
    });

    expect(errors).toContain('Updater public key is missing or still uses a placeholder value.');
    expect(errors).toContain(
      'Disable the updater until a real public key and endpoint are configured.',
    );
  });

  it('rejects placeholder owner or repo endpoints', () => {
    const errors = validateUpdaterReleaseConfig({
      bundle: {
        createUpdaterArtifacts: true,
      },
      plugins: {
        updater: {
          active: false,
          endpoints: [
            'https://github.com/YOUR_USERNAME/YOUR_REPO/releases/latest/download/latest.json',
          ],
          pubkey: 'RWQ53Cy9BeOLwhXbRW5t2s2XB7Z3G7UXEFrJ7zGKpiN51JNg0Fud7rV6',
        },
      },
    });

    expect(errors).toContain('Updater release endpoint still uses a placeholder value.');
    expect(errors).toContain(
      'Updater must be active when updater artifacts are enabled for release.',
    );
  });

  it('rejects a file path used as the updater public key', () => {
    const errors = validateUpdaterReleaseConfig({
      bundle: {
        createUpdaterArtifacts: true,
      },
      plugins: {
        updater: {
          active: true,
          endpoints: [
            'https://github.com/sahildave/skilltopia/releases/latest/download/latest.json',
          ],
          pubkey: '~/.tauri/skilltopia.key.pub',
        },
      },
    });

    expect(errors).toContain(
      'Updater public key must be the minisign public key string, not a file path or invalid value.',
    );
    expect(errors).toContain(
      'Disable the updater until a real public key and endpoint are configured.',
    );
  });

  it('allows release config with a real public key and GitHub latest endpoint', () => {
    const errors = validateUpdaterReleaseConfig({
      bundle: {
        createUpdaterArtifacts: true,
      },
      plugins: {
        updater: {
          active: true,
          endpoints: [
            'https://github.com/sahildave/skilltopia/releases/latest/download/latest.json',
          ],
          pubkey: 'RWQ53Cy9BeOLwhXbRW5t2s2XB7Z3G7UXEFrJ7zGKpiN51JNg0Fud7rV6',
        },
      },
    });

    expect(errors).toEqual([]);
  });

  it('rejects a keyed release config if the updater is still inactive', () => {
    const errors = validateUpdaterReleaseConfig({
      bundle: {
        createUpdaterArtifacts: true,
      },
      plugins: {
        updater: {
          active: false,
          endpoints: [
            'https://github.com/sahildave/skilltopia/releases/latest/download/latest.json',
          ],
          pubkey: 'RWQ53Cy9BeOLwhXbRW5t2s2XB7Z3G7UXEFrJ7zGKpiN51JNg0Fud7rV6',
        },
      },
    });

    expect(errors).toEqual([
      'Updater must be active when updater artifacts are enabled for release.',
    ]);
  });
});
