import { isUnipaUrl } from '../shared/hosts';

chrome.runtime.onInstalled.addListener(() => {
  // 遠隔の設定取得や計測はしない。初期値は画面を開いたときにローカルへ書く。
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !isUnipaUrl(tab.url ?? '')) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'hcu-open-settings' });
  } catch {
    // いちぽるの画面にスクリプトが無いときは、別ページは開かない。
  }
});
