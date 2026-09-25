import { isUnipaUrl } from '../shared/hosts';
import { SyllabusLookup } from '../content/syllabus-lookup';

chrome.runtime.onInstalled.addListener(() => {
  // 遠隔の設定取得や計測はしない。初期値は画面を開いたときにローカルへ書く。
});

chrome.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse) => {
  if (message?.type !== 'hcu-syllabus-refresh') return;
  // TODO(Unipaヘルパー): ゲスト画面の項目が届くまで refresh は取得しない。
  void SyllabusLookup.refresh().then(sendResponse);
  return true;
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
