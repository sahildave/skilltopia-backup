import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const iconArgs = process.argv.slice(2);

const result = spawnSync('npm', ['run', 'tauri', '--', 'icon', ...iconArgs], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

// Tauri always emits mobile icons; this app is desktop-only.
for (const dir of ['android', 'ios']) {
  rmSync(resolve(root, 'src-tauri/icons', dir), { recursive: true, force: true });
}

console.log('Removed iOS/Android icon output (desktop-only bundle).');
