import { isUnipaUrl } from '../shared/hosts';

chrome.runtime.onInstalled.addListener(() => {
  // 遠隔の設定取得や計測はしない。初期値は画面を開いたときにローカルへ書く。
});

chrome.action.onClicked.addListener(async (tab) => {
  const url = tab.url ?? '';
  if (tab.id && isUnipaUrl(url)) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'hcu-open-settings' });
      return;
    } catch {
      // コンテンツスクリプトがまだ無い画面では、設定ページを開く。
    }
  }
  await chrome.runtime.openOptionsPage();
});
