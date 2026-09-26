import { isUnipaAppPath } from '../shared/hosts';
import { defaultSettings } from '../shared/defaults';
import { loadSettings, watchSettings } from '../shared/storage';
import type { Settings } from '../shared/types';
import { applyColoring } from './apply';
import { createCourseCache, type CourseCache } from './cache';
import { renderLegend } from './legend';
import { extractRecordsFromPayload } from './parse-payload';
import { LIVE_PAGE } from './selectors';

const NET_SOURCE = 'hcu-rishu-net';
const SETTINGS_SOURCE = 'hcu-rishu-settings';
const CACHE_KEY = 'hcu-rishu-color-cache';

function openSettings(): void {
  const mount = () => {
    if (!document.body || document.getElementById('hcu-rc-frame')) return;
    const frame = document.createElement('iframe');
    frame.id = 'hcu-rc-frame';
    frame.title = '履修パレットの設定';
    frame.src = chrome.runtime.getURL('settings.html?embed=1');
    document.body.appendChild(frame);
  };
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
}

function closeSettings(): void {
  document.getElementById('hcu-rc-frame')?.remove();
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

async function loadSession(cache: CourseCache): Promise<void> {
  if (!chrome.storage?.session) return;
  const data = await chrome.storage.session.get(CACHE_KEY);
  const records = data[CACHE_KEY];
  if (Array.isArray(records)) cache.load(records);
}

function persistSession(cache: CourseCache): void {
  if (!chrome.storage?.session) return;
  void chrome.storage.session.set({ [CACHE_KEY]: cache.snapshot() });
}

function boot(): void {
  const onSettings = (event: MessageEvent) => {
    if (event.origin !== `chrome-extension://${chrome.runtime.id}`) return;
    const data = event.data as { source?: string; type?: string; saved?: boolean } | null;
    if (data?.source === SETTINGS_SOURCE && data.type === 'close') {
      closeSettings();
      if (data.saved) showSavedSnack();
    }
  };

  window.addEventListener('message', onSettings);
  chrome.runtime.onMessage.addListener((message: { type?: string }) => {
    if (message?.type === 'hcu-open-settings') openSettings();
  });

  if (!isUnipaAppPath(location.pathname)) return;

  let settings: Settings = defaultSettings();
  const cache = createCourseCache();
  let timer = 0;
  let persistTimer = 0;

  const paint = () => {
    if (!document.body) return;
    const stats = applyColoring(document.body, settings, cache);
    renderLegend(stats, settings, openSettings);
    window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => persistSession(cache), 400);
  };

  const schedule = () => {
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
    const tab = target.closest('a, button, [role="tab"]');
    const text = (tab?.textContent ?? '').replace(/\s+/g, '');
    if ((LIVE_PAGE.tabLabels as readonly string[]).includes(text)) schedule();
  };

  window.addEventListener('message', onNet);
  document.addEventListener('click', onTab, true);
  watchSettings((next) => {
    settings = next;
    schedule();
  });

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
    observer.observe(document.documentElement, { childList: true, subtree: true });
    paint();
  };

  void loadSettings().then(async (next) => {
    settings = next;
    await loadSession(cache);
  }).then(() => {
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  });
}

boot();
