import { isUnipaAppPath } from '../shared/hosts';
import { defaultSettings } from '../shared/defaults';
import { extensionContextAlive, isContextInvalidated, loadSettings, watchSettings } from '../shared/storage';
import type { Settings } from '../shared/types';
import { applyColoring } from './apply';
import { createCourseCache, type CourseCache } from './cache';
import { renderLegend } from './legend';
import { mountSettingsFrame, unmountSettingsFrame } from './settings-frame';
import { extractRecordsFromPayload } from './parse-payload';
import { LIVE_PAGE } from './selectors';

const NET_SOURCE = 'hcu-rishu-net';
const SETTINGS_SOURCE = 'hcu-rishu-settings';
const CACHE_KEY = 'hcu-rishu-color-cache';
const REOPEN_KEY = 'hcu-rc-open-after-reload';

let halted = false;
const cleanups: Array<() => void> = [];

function halt(): void {
  if (halted) return;
  halted = true;
  for (const cleanup of cleanups) {
    try {
      cleanup();
    } catch {
      // 拡張が無効になったあとは chrome.runtime 自体が消えていることがあり、後片付けの失敗は無視する。
    }
  }
  cleanups.length = 0;
}

function alive(): boolean {
  if (halted) return false;
  if (!extensionContextAlive()) {
    halt();
    return false;
  }
  return true;
}

function inTopFrame(): boolean {
  try {
    return window.top === window;
  } catch {
    return false;
  }
}

function reopenAfterReload(): void {
  halt();
  try {
    sessionStorage.setItem(REOPEN_KEY, '1');
  } catch {
    /* 保存できなくても、再読み込みで新しいスクリプトに切り替える */
  }
  location.reload();
}

function openSettings(): void {
  if (!inTopFrame()) return;
  const mount = () => {
    try {
      if (!document.body || document.getElementById('hcu-rc-frame')) return;
      if (!alive()) {
        reopenAfterReload();
        return;
      }
      mountSettingsFrame(chrome.runtime.getURL('settings.html?embed=1'));
    } catch (error) {
      if (isContextInvalidated(error)) reopenAfterReload();
      else throw error;
    }
  };
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
}

function closeSettings(): void {
  unmountSettingsFrame();
}

const SAVED_NOTICE = '保存しました。開いている履修一覧に反映されます。';
let savedSnackTimer = 0;

function showSavedSnack(): void {
  document.getElementById('hcu-rc-snack')?.remove();
  const snack = document.createElement('div');
  snack.id = 'hcu-rc-snack';
  snack.setAttribute('role', 'status');
  snack.textContent = SAVED_NOTICE;
  document.body.appendChild(snack);
  window.clearTimeout(savedSnackTimer);
  savedSnackTimer = window.setTimeout(() => snack.remove(), 4000);
}

// 科目キャッシュは無くても色分けできる。session storage が使えない場合も、起動は止めない。
async function loadSession(cache: CourseCache): Promise<void> {
  try {
    if (!alive() || !chrome.storage?.session) return;
    const data = await chrome.storage.session.get(CACHE_KEY);
    const records = data[CACHE_KEY];
    if (Array.isArray(records)) cache.load(records);
  } catch (error) {
    if (isContextInvalidated(error)) halt();
  }
}

function persistSession(cache: CourseCache): void {
  try {
    if (!alive() || !chrome.storage?.session) return;
    void chrome.storage.session.set({ [CACHE_KEY]: cache.snapshot() }).catch((error: unknown) => {
      if (isContextInvalidated(error)) halt();
    });
  } catch (error) {
    if (isContextInvalidated(error)) halt();
  }
}

function boot(): void {
  const onSettings = (event: MessageEvent) => {
    if (!alive()) return;
    let origin: string;
    try {
      origin = `chrome-extension://${chrome.runtime.id}`;
    } catch (error) {
      if (isContextInvalidated(error)) halt();
      else throw error;
      return;
    }
    if (event.origin !== origin) return;
    const data = event.data as { source?: string; type?: string; saved?: boolean } | null;
    if (data?.source === SETTINGS_SOURCE && data.type === 'close') {
      closeSettings();
      if (data.saved) showSavedSnack();
    }
  };

  window.addEventListener('message', onSettings);
  cleanups.push(() => window.removeEventListener('message', onSettings));
  if (inTopFrame()) {
    try {
      if (sessionStorage.getItem(REOPEN_KEY) === '1') {
        sessionStorage.removeItem(REOPEN_KEY);
        openSettings();
      }
    } catch {
      /* 読み直したあとに設定を開き直せないだけなので、色分け自体は続ける */
    }
  }
  if (alive()) {
    const onCommand = (message: { type?: string }) => {
      if (!alive()) return;
      if (message?.type === 'hcu-open-settings') openSettings();
    };
    chrome.runtime.onMessage.addListener(onCommand);
    cleanups.push(() => {
      chrome.runtime.onMessage.removeListener(onCommand);
    });
  }

  if (!isUnipaAppPath(location.pathname)) return;

  let settings: Settings = defaultSettings();
  const cache = createCourseCache();
  let timer = 0;
  let persistTimer = 0;

  const paint = () => {
    if (!alive() || !document.body) return;
    const stats = applyColoring(document.body, settings, cache);
    renderLegend(stats, settings, openSettings);
    window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => persistSession(cache), 400);
  };

  const schedule = () => {
    if (!alive()) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(paint, 120);
  };

  const onNet = (event: MessageEvent) => {
    if (event.origin !== location.origin || event.source !== window) return;
    const data = event.data as { source?: string; text?: string } | null;
    if (!data || data.source !== NET_SOURCE || typeof data.text !== 'string') return;
    const records = extractRecordsFromPayload(data.text);
    if (records.length === 0) return;
    for (const record of records) cache.add(record);
    schedule();
  };

  const onTab = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.hcu-rc-open')) {
      event.preventDefault();
      event.stopPropagation();
      openSettings();
      return;
    }
    const tab = target.closest('a, button, [role="tab"]');
    const text = (tab?.textContent ?? '').replace(/\s+/g, '');
    if ((LIVE_PAGE.tabLabels as readonly string[]).includes(text)) schedule();
  };

  window.addEventListener('message', onNet);
  document.addEventListener('pointerdown', onTab, true);
  document.addEventListener('click', onTab, true);
  cleanups.push(
    () => window.removeEventListener('message', onNet),
    () => document.removeEventListener('pointerdown', onTab, true),
    () => document.removeEventListener('click', onTab, true),
    () => window.clearTimeout(timer),
    () => window.clearTimeout(persistTimer),
    watchSettings((next) => {
      settings = next;
      schedule();
    }),
  );

  const observer = new MutationObserver((mutations) => {
    const own = mutations.every((mutation) => {
      const target = mutation.target;
      if (target instanceof Element && target.closest('#hcu-rc-host, #hcu-rc-frame, #hcu-rc-snack')) return true;
      const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
      return (
        nodes.length > 0 &&
        nodes.every(
          (node) =>
            node instanceof Element &&
            (node.classList.contains('hcu-rc-badge') ||
              node.id === 'hcu-rc-host' ||
              node.id === 'hcu-rc-frame' ||
              node.id === 'hcu-rc-snack'),
        )
      );
    });
    if (!own) schedule();
  });

  const start = () => {
    if (!alive()) return;
    observer.observe(document.documentElement, { childList: true, subtree: true });
    cleanups.push(() => observer.disconnect());
    paint();
  };

  void loadSettings()
    .then(async (next) => {
      settings = next;
      await loadSession(cache);
    })
    .catch((error: unknown) => {
      if (isContextInvalidated(error)) halt();
    })
    .then(() => {
      if (document.body) start();
      else document.addEventListener('DOMContentLoaded', start, { once: true });
    });
}

boot();
