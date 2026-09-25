/** 行内リンクのうち、同じいちぽる画面への GET だけを追加取得の対象にする。 */
export function safeSyllabusUrl(href: string, base: string): string | null {
  if (!href || /^\s*javascript:/i.test(href)) return null;
  let url: URL;
  let baseUrl: URL;
  try {
    baseUrl = new URL(base);
    url = new URL(href, baseUrl);
  } catch {
    return null;
  }
  if (url.origin !== baseUrl.origin) return null;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!url.pathname.includes('/uprx/')) return null;
  if (!url.pathname.endsWith('.xhtml')) return null;
  if (url.search.length < 2) return null;
  return url.href;
}
