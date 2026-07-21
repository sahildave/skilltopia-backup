/** Public GitHub repository for Skilltopia. */
export const GITHUB_REPO_URL = 'https://github.com/sahildave/skilltopia';

/** Latest desktop release page — acquisition CTA for the web Library. */
export const DESKTOP_APP_DOWNLOAD_URL = `${GITHUB_REPO_URL}/releases/latest`;

/** Coduo attribution link — `source` reflects build target (desktop app vs web). */
export const CODUO_URL = `https://www.coduo.co/?via=skilltopia&source=${
  __APP_TARGET__ === 'desktop' ? 'app' : 'web'
}`;
