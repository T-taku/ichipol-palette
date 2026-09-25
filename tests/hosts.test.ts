import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isUnipaAppPath, isUnipaHostname, isUnipaUrl, UNIPA_MATCHES } from '../src/shared/hosts';

describe('対象ホスト', () => {
  it('いちぽると UNIPA のホストだけを対象にする', () => {
    expect(isUnipaHostname('ichipol.g.hiroshima-cu.ac.jp')).toBe(true);
    expect(isUnipaHostname('ichipol.hiroshima-cu.ac.jp')).toBe(true);
    expect(isUnipaUrl('https://ichipol.g.hiroshima-cu.ac.jp/uprx/')).toBe(true);
    expect(isUnipaHostname('www.hiroshima-cu.ac.jp')).toBe(false);
    expect(isUnipaUrl('https://www.hiroshima-cu.ac.jp/campuslife/')).toBe(false);
    expect(isUnipaUrl('http://ichipol.g.hiroshima-cu.ac.jp/uprx/')).toBe(false);
    expect(UNIPA_MATCHES.every((pattern) => pattern.startsWith('https://'))).toBe(true);
  });

  it('ログイン画面では動かない', () => {
    expect(isUnipaAppPath('/uprx/up/km/kmd004/Kmd00401.xhtml')).toBe(true);
    expect(isUnipaAppPath('/uprx/up/bs/bsa001/Bsa00101.xhtml')).toBe(true);
    expect(isUnipaAppPath('/uprx/up/pk/pky001/Pky00102.xhtml')).toBe(true);
    expect(isUnipaAppPath('/uprx/ShibbolethAuthServlet')).toBe(false);
    expect(isUnipaAppPath('/campuslife/')).toBe(false);
  });
});

describe('外部通信を足さない', () => {
  it('ソースに計測用やフォント配信用の URL を書かない', () => {
    const files = walk('src').concat(walk('scripts'));
    const found: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/https?:\/\/[^\s'")]+/g)) {
        const url = match[0];
        if (/hiroshima-cu\.ac\.jp|www\.w3\.org/.test(url)) continue;
        found.push(`${file}: ${url}`);
      }
    }
    expect(found).toEqual([]);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx|css|html|mjs|js|json)$/.test(name) ? [path] : [];
  });
}
