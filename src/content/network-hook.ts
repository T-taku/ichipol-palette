import { isUnipaHostname } from '../shared/hosts';

/**
 * ページ本体の fetch / XHR を観測する。
 * 応答は同じオリジンの window に渡すだけで、外部へは送らない。
 * 拡張の content script（isolated world）からはページの fetch を包めないため、MAIN world で動かす。
 */
const SOURCE = 'hcu-rishu-net';
const MAX_CHARS = 400_000;

function relevant(text: string): boolean {
  return /開講|学科|科目区分|授業科目|授業コード|jugyo|gakka|kyotsu|partial-response|kamoku/i.test(text);
}

function sameOrigin(raw: string): boolean {
  try {
    return new URL(raw, location.href).origin === location.origin;
  } catch {
    return false;
  }
}

function publish(url: string, text: string): void {
  if (!text || text.length > MAX_CHARS || !relevant(text)) return;
  window.postMessage({ source: SOURCE, url, text }, location.origin);
}

function tapResponse(url: string, response: Response): void {
  if (!sameOrigin(url)) return;
  const type = response.headers.get('content-type') ?? '';
  if (/javascript|css|image|font|audio|video|octet-stream/i.test(type)) return;
  response
    .clone()
    .text()
    .then((text) => publish(url, text))
    .catch(() => undefined);
}

function install(): void {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const pending = originalFetch(input, init);
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    pending.then((response) => tapResponse(raw, response)).catch(() => undefined);
    return pending;
  };

  const urls = new WeakMap<XMLHttpRequest, string>();
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ) {
    urls.set(this, String(url));
    return originalOpen.call(this, method, url, async ?? true, username, password);
  };

  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    this.addEventListener('load', () => {
      try {
        const url = urls.get(this) ?? '';
        if (!sameOrigin(url)) return;
        const type = this.getResponseHeader('content-type') ?? '';
        if (/javascript|css|image|font|octet-stream/i.test(type)) return;
        const responseType = this.responseType;
        if (responseType === 'arraybuffer' || responseType === 'blob' || responseType === 'document' || responseType === 'json') return;
        publish(url, this.responseText ?? '');
      } catch {
        // ページ側の通信は止めない。
      }
    });
    return originalSend.call(this, body);
  };
}

if (isUnipaHostname(location.hostname) && location.pathname.includes('/uprx/')) {
  try {
    install();
  } catch {
    // フックに失敗しても履修登録そのものは続行する。
  }
}
