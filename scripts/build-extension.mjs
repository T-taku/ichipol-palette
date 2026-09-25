import { build } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
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
  writeFileSync(join(iconsDir, `icon${size}.png`), png(size, iconPixel));
}

const manifest = {
  manifest_version: 3,
  name: 'いちぽる履修カラー',
  version: '1.0.0',
  description: '広島市立大学のいちぽる（UNIPA）で、自学科・他学科・共通科目を色分けします。通信や計測はしません。',
  permissions: ['storage'],
  host_permissions: matches,
  background: { service_worker: 'background.js' },
  action: {
    default_title: '履修カラーの設定',
    default_icon: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
    },
  },
  options_ui: { page: 'settings.html', open_in_tab: true },
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

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixel(x, y, size);
      const index = row + 1 + x * 4;
      raw[index] = r;
      raw[index + 1] = g;
      raw[index + 2] = b;
      raw[index + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function insideRoundRect(x, y, size, pad, radius) {
  const left = pad;
  const right = size - pad - 1;
  const top = pad;
  const bottom = size - pad - 1;
  if (x < left || x > right || y < top || y > bottom) return false;
  const cx = x < left + radius ? left + radius : x > right - radius ? right - radius : x;
  const cy = y < top + radius ? top + radius : y > bottom - radius ? bottom - radius : y;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function iconPixel(x, y, size) {
  const pad = Math.max(1, Math.round(size * 0.08));
  const radius = Math.max(2, Math.round(size * 0.22));
  if (!insideRoundRect(x, y, size, pad, radius)) return [0, 0, 0, 0];
  const colors = [
    [215, 243, 227],
    [253, 231, 199],
    [217, 231, 251],
  ];
  const barTop = size * 0.26;
  const barHeight = size * 0.14;
  const gap = size * 0.07;
  for (let index = 0; index < colors.length; index += 1) {
    const top = barTop + index * (barHeight + gap);
    if (y >= top && y < top + barHeight && x > size * 0.22 && x < size * 0.78) return [...colors[index], 255];
  }
  return [27, 58, 75, 255];
}
