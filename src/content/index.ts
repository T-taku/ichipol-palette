import { isUnipaAppPath } from '../shared/hosts';
import { defaultSettings } from '../shared/defaults';
import { loadSettings, watchSettings } from '../shared/storage';
import type { Settings } from '../shared/types';
import { applyColoring } from './apply';
import { createCourseCache, type CourseCache } from './cache';
import { renderLegend } from './legend';
import { extractRecordsFromPayload } from './parse-payload';
import { safeSyllabusUrl } from './urls';
import { findCourseRows } from './extract-dom';
import { LIVE_PAGE } from './selectors';
import { isGuestSyllabusPath, SyllabusLookup } from './syllabus-lookup';

const NET_SOURCE = 'hcu-rishu-net';
const SETTINGS_SOURCE = 'hcu-rishu-settings';
const CACHE_KEY = 'hcu-rishu-color-cache';

function openSettings(): void {
  if (document.getElementById('hcu-rc-frame')) return;
  const frame = document.createElement('iframe');
  frame.id = 'hcu-rc-frame';
  frame.title = '履修カラー設定';
  frame.src = chrome.runtime.getURL('settings.html?embed=1');
  document.body.appendChild(frame);
}

function closeSettings(): void {
  document.getElementById('hcu-rc-frame')?.remove();
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
  if (!isUnipaAppPath(location.pathname)) return;

  let settings: Settings = defaultSettings();
  const cache = createCourseCache();
  const syllabus = new SyllabusLookup();
  const lookedUp = new Set<string>();
  let lookupBudget = 30;
  let timer = 0;
  let persistTimer = 0;

  const paint = () => {
    if (!document.body) return;
    if (isGuestSyllabusPath(location.pathname)) {
      const records = syllabus.ingestGuestDocument(document.body);
      if (records.length > 0 && syllabus.absorb(records)) void syllabus.save();
    }
    const stats = applyColoring(document.body, settings, cache, syllabus);
    renderLegend(stats, settings, openSettings);
    if (settings.allowSameOriginLookup) queueLookups();
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

  const onSettings = (event: MessageEvent) => {
    if (event.origin !== `chrome-extension://${chrome.runtime.id}`) return;
    const data = event.data as { source?: string; type?: string } | null;
    if (data?.source === SETTINGS_SOURCE && data.type === 'close') closeSettings();
  };

  const onTab = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const tab = target.closest('a, button, [role="tab"]');
    const text = (tab?.textContent ?? '').replace(/\s+/g, '');
    if ((LIVE_PAGE.tabLabels as readonly string[]).includes(text)) schedule();
  };

  window.addEventListener('message', onNet);
  window.addEventListener('message', onSettings);
  document.addEventListener('click', onTab, true);
  chrome.runtime.onMessage.addListener((message: { type?: string }) => {
    if (message?.type === 'hcu-open-settings') openSettings();
  });
  watchSettings((next) => {
    settings = next;
    schedule();
  });

  const observer = new MutationObserver((mutations) => {
    const own = mutations.every((mutation) => {
      const target = mutation.target;
      if (target instanceof Element && target.closest('#hcu-rc-host, #hcu-rc-frame')) return true;
      const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
      return (
        nodes.length > 0 &&
        nodes.every(
          (node) =>
            node instanceof Element &&
            (node.classList.contains('hcu-rc-badge') || node.id === 'hcu-rc-host' || node.id === 'hcu-rc-frame'),
        )
      );
    });
    if (!own) schedule();
  });

  const start = () => {
    observer.observe(document.documentElement, { childList: true, subtree: true });
    paint();
  };

  syllabus.watch(() => schedule());

  void loadSettings().then(async (next) => {
    settings = next;
    await loadSession(cache);
    await syllabus.load();
  }).then(() => {
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  });

  function queueLookups(): void {
    if (lookupBudget <= 0) return;
    const hrefs: string[] = [];
    for (const item of findCourseRows(document.body)) {
      if (item.record.department || item.record.division) continue;
      for (const anchor of item.row.querySelectorAll('a[href]')) {
        const safe = safeSyllabusUrl(anchor.getAttribute('href') ?? '', location.href);
        if (!safe || lookedUp.has(safe)) continue;
        hrefs.push(safe);
      }
    }
    for (const href of hrefs) {
      if (lookupBudget <= 0) return;
      lookupBudget -= 1;
      lookedUp.add(href);
      void fetch(href, { credentials: 'same-origin', headers: { accept: 'text/html' } })
        .then((response) => {
          if (new URL(response.url).origin !== location.origin) return '';
          return response.text();
        })
        .then((text) => {
          if (!text) return;
          for (const record of extractRecordsFromPayload(text)) cache.add(record);
          schedule();
        })
        .catch(() => undefined);
    }
  }
}

boot();
