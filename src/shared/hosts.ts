/**
 * コンテンツスクリプトはホスト全体にマッチする。
 * 認証の入口は `https://ichipol.g.hiroshima-cu.ac.jp/uprx/ShibbolethAuthServlet`。
 * セッションのない `/uprx/up/...` 直リンクは開かない。色分けは `isUnipaAppPath` の `.xhtml` 画面だけで行う。
 * `*` はラベル1つ分なので、ichipol.g は個別に書く。
 */
export const UNIPA_MATCHES = [
  'https://ichipol.g.hiroshima-cu.ac.jp/*',
  'https://ichipol.hiroshima-cu.ac.jp/*',
  'https://*.g.hiroshima-cu.ac.jp/*',
  'https://unipa.hiroshima-cu.ac.jp/*',
] as const;

export function isUnipaHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'ichipol.g.hiroshima-cu.ac.jp' ||
    host === 'ichipol.hiroshima-cu.ac.jp' ||
    host.endsWith('.g.hiroshima-cu.ac.jp') ||
    host === 'unipa.hiroshima-cu.ac.jp'
  );
}

export function isUnipaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && isUnipaHostname(parsed.hostname);
  } catch {
    return false;
  }
}

export function isUnipaAppPath(pathname: string): boolean {
  if (!pathname.includes('/uprx/')) return false;
  if (/shibboleth|\/login|\/logout/i.test(pathname) && !pathname.endsWith('.xhtml')) return false;
  return true;
}
