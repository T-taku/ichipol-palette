// コンテンツスクリプトから科目キャッシュ（chrome.storage.session）を読めるようにする。既定では拒否される。
void chrome.storage.session
  .setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
  .catch(() => {});

chrome.runtime.onInstalled.addListener(() => {
  // 遠隔の設定取得や計測はしない。初期値は画面を開いたときにローカルへ書く。
});

const SAVED_NOTICE = '保存しました。開いている履修一覧に反映されます。';

// executeScript でページへ渡すため、外の変数や import を参照しない自己完結した関数にしておく。
function mountOverlay(src: string, origin: string, notice: string): void {
  if (document.getElementById('hcu-rc-frame')) return;
  const host = document.createElement('div');
  host.id = 'hcu-rc-frame';
  host.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;margin:0;padding:0;border:0;background:transparent;z-index:2147483646';
  const frame = document.createElement('iframe');
  frame.title = '履修パレットの設定';
  frame.src = src;
  frame.style.cssText = 'display:block;width:100%;height:100%;border:0;margin:0;background:transparent';
  host.append(frame);
  document.documentElement.append(host);

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== origin || event.source !== frame.contentWindow) return;
    const data = event.data as { source?: string; type?: string; saved?: boolean } | null;
    if (data?.source !== 'hcu-rishu-settings' || data.type !== 'close') return;
    window.removeEventListener('message', onMessage);
    host.remove();
    if (!data.saved) return;
    document.getElementById('hcu-rc-snack')?.remove();
    const snack = document.createElement('div');
    snack.id = 'hcu-rc-snack';
    snack.setAttribute('role', 'status');
    snack.textContent = notice;
    snack.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:24px',
      'transform:translateX(-50%)',
      'z-index:2147483647',
      'max-width:min(480px, calc(100vw - 32px))',
      'background:#102735',
      'color:#fffdf8',
      'font:14px/1.5 "Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI",Meiryo,sans-serif',
      'padding:12px 16px',
      'border-radius:8px',
      'box-shadow:0 8px 24px rgba(28,36,48,0.24)',
    ].join(';');
    document.documentElement.append(snack);
    window.setTimeout(() => snack.remove(), 4000);
  };
  window.addEventListener('message', onMessage);
}

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id === undefined) return;
  try {
    // いちぽるの画面では、コンテンツスクリプトが自分でモーダルを開く。
    await chrome.tabs.sendMessage(tab.id, { type: 'hcu-open-settings' });
    return;
  } catch {
    // 受け手がいないページ（いちぽる以外、または拡張を読み直した直後のタブ）はここへ来る。
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: mountOverlay,
      args: [chrome.runtime.getURL('settings.html?embed=1'), `chrome-extension://${chrome.runtime.id}`, SAVED_NOTICE],
    });
  } catch {
    // chrome:// や新しいタブなど、拡張が触れないページでは設定を別タブで開く。
    await chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
  }
});
