import { resolve } from 'node:path';
import { assertCleanWebBundle } from './web-bundle-utils.mjs';

const distDir = resolve(process.argv[2] ?? 'dist');

await assertCleanWebBundle(distDir);
console.log(`Web bundle clean of Tauri markers: ${distDir}`);
