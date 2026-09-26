import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const manifestPath = join(dist, 'manifest.json');
if (!existsSync(manifestPath)) throw new Error('dist/manifest.json がありません。先にビルドしてください');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (typeof manifest.description !== 'string' || manifest.description.length > 132) {
  throw new Error(`description は 132 文字以内です（今は ${manifest.description?.length ?? 0}）`);
}

const outDir = join(root, 'release');
mkdirSync(outDir, { recursive: true });
const zipPath = join(outDir, `ichipol-palette-${manifest.version}.zip`);
rmSync(zipPath, { force: true });

const result = spawnSync('zip', ['-r', '-X', zipPath, '.', '-x', '*.map', '-x', '.DS_Store'], {
  cwd: dist,
  stdio: 'inherit',
});
if (result.status !== 0) throw new Error('zip に失敗しました');

const listing = spawnSync('unzip', ['-l', zipPath], { encoding: 'utf8' });
const lines = listing.stdout.split('\n').map((line) => line.trim());
const hasManifest = lines.some((line) => line.endsWith('manifest.json') && !line.includes('/'));
if (!hasManifest) throw new Error('ZIP の直下に manifest.json がありません');

console.log(`store package written to ${zipPath}`);
