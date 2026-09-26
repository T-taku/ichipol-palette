import { isUnipaAppPath, isUnipaUrl } from '../shared/hosts';

// コンテンツスクリプトから科目キャッシュ（chrome.storage.session）を読めるようにする。既定では拒否される。
void chrome.storage.session
  .setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
  .catch(() => {});

chrome.runtime.onInstalled.addListener(() => {
  // 遠隔の設定取得や計測はしない。初期値は画面を開いたときにローカルへ書く。
});

function isRegistrationScreen(url: string): boolean {
  if (!isUnipaUrl(url)) return false;
  try {
    return isUnipaAppPath(new URL(url).pathname);
  } catch {
    return false;
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id !== undefined && isRegistrationScreen(tab.url ?? '')) {
    try {
      // いちぽるの画面では、コンテンツスクリプトがその場に設定モーダルを開く。
      await chrome.tabs.sendMessage(tab.id, { type: 'hcu-open-settings' });
      return;
    } catch {
      // 拡張を読み直した直後などで受け手がいないときは、設定ページを開く。
    }
  }
  await chrome.runtime.openOptionsPage();
});
