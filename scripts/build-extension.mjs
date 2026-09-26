import { build } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const hostSource = readFileSync(join(root, 'src/shared/hosts.ts'), 'utf8');
const matches = [...hostSource.matchAll(/'(https:\/\/[^']+)'/g)].map((match) => match[1]);
if (matches.length === 0) throw new Error('UNIPA のホストパターンを hosts.ts から読めませんでした');

await build({
  entryPoints: [join(root, 'src/content/index.ts')],
  bundle: true,
  outfile: join(dist, 'content.js'),
  format: 'iife',
  target: 'chrome120',
  legalComments: 'none',
});

await build({
  entryPoints: [join(root, 'src/content/network-hook.ts')],
  bundle: true,
  outfile: join(dist, 'network-hook.js'),
  format: 'iife',
  target: 'chrome120',
  legalComments: 'none',
});

await build({
  entryPoints: [join(root, 'src/background/index.ts')],
  bundle: true,
  outfile: join(dist, 'background.js'),
  format: 'iife',
  target: 'chrome120',
  legalComments: 'none',
});

copyFileSync(join(root, 'src/content/styles.css'), join(dist, 'content.css'));

const indexHtml = join(dist, 'index.html');
const settingsHtml = join(dist, 'settings.html');
if (existsSync(indexHtml)) renameSync(indexHtml, settingsHtml);
if (!existsSync(settingsHtml)) throw new Error('設定ページの HTML が dist にありません');

const nestedDemo = join(dist, 'demo.html');
if (existsSync(nestedDemo)) rmSync(nestedDemo);

const iconsDir = join(dist, 'icons');
mkdirSync(iconsDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const file = `icon${size}.png`;
  const source = join(root, 'assets/icons', file);
  if (!existsSync(source)) throw new Error(`${file} が assets/icons にありません`);
  copyFileSync(source, join(iconsDir, file));
}

const manifest = {
  manifest_version: 3,
  name: 'いちぽる履修パレット',
  version: '1.0.0',
  description: '広島市立大学のいちぽる（UNIPA）で、履修登録とシラバス検索の科目を自学科・他学科・共通科目に色分けします。',
  permissions: ['storage'],
  host_permissions: matches,
  background: { service_worker: 'background.js' },
  action: {
    default_title: '履修パレットの設定',
    default_icon: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
    },
  },
  icons: {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  content_scripts: [
    {
      matches,
      js: ['network-hook.js'],
      run_at: 'document_start',
      all_frames: true,
      world: 'MAIN',
    },
    {
      matches,
      js: ['content.js'],
      css: ['content.css'],
      run_at: 'document_start',
      all_frames: true,
    },
  ],
  web_accessible_resources: [
    {
      resources: ['settings.html', 'assets/*'],
      matches,
    },
  ],
};

writeFileSync(join(dist, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const forbidden = /google-analytics|googletagmanager|doubleclick\.net|sentry\.io|mixpanel\.com|segment\.io|fonts\.googleapis|fonts\.gstatic|unpkg\.com|cdn\.jsdelivr|facebook\.net/i;
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(js|html|css|json)$/.test(name) ? [path] : [];
  });
}
for (const path of walk(dist)) {
  const text = readFileSync(path, 'utf8');
  if (forbidden.test(text)) throw new Error(`${path} に外部サービスへの参照があります`);
}

console.log(`extension written to ${dist}`);
