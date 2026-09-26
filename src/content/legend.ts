import { resolvedFaculty } from '../shared/defaults';
import { CATEGORY_LABEL, type Settings } from '../shared/types';
import type { ApplyStats } from './apply';

function inTopFrame(): boolean {
  try {
    return window.top === window;
  } catch {
    return false;
  }
}

const COLLAPSE_KEY = 'hcu-rc-legend-collapsed';

function readCollapsed(): boolean {
  try {
    return sessionStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

let collapsed = readCollapsed();

function writeCollapsed(next: boolean): void {
  collapsed = next;
  try {
    sessionStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
  } catch {
    /* ページ側の storage が使えないときは、この読み込みのあいだだけ覚える */
  }
}

function ensureHost(): HTMLElement {
  const existing = document.getElementById('hcu-rc-host');
  if (existing) return existing;
  const host = document.createElement('div');
  host.id = 'hcu-rc-host';
  document.body.appendChild(host);
  return host;
}

function applyCollapsed(panel: HTMLElement, head: HTMLButtonElement): void {
  panel.classList.toggle('is-collapsed', collapsed);
  head.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  head.setAttribute('aria-label', collapsed ? '履修カラーを開く' : '履修カラーを閉じる');
  const body = panel.querySelector('.hcu-rc-body');
  if (body instanceof HTMLElement) {
    if (collapsed) body.setAttribute('inert', '');
    else body.removeAttribute('inert');
  }
}

function ensurePanel(host: HTMLElement): HTMLElement {
  const existing = host.querySelector<HTMLElement>(':scope > .hcu-rc-panel');
  if (existing) return existing;

  const panel = document.createElement('aside');
  panel.className = 'hcu-rc-panel';
  panel.setAttribute('aria-label', '履修カラー');

  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'hcu-rc-head';
  head.setAttribute('aria-controls', 'hcu-rc-legend-body');

  const title = document.createElement('span');
  title.className = 'hcu-rc-title';
  title.textContent = '履修カラー';
  const chevron = document.createElement('span');
  chevron.className = 'hcu-rc-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  head.append(title, chevron);
  head.addEventListener('click', () => {
    writeCollapsed(!collapsed);
    applyCollapsed(panel, head);
  });

  const body = document.createElement('div');
  body.id = 'hcu-rc-legend-body';
  body.className = 'hcu-rc-body';
  const inner = document.createElement('div');
  inner.className = 'hcu-rc-body-inner';
  body.append(inner);
  panel.append(head, body);
  applyCollapsed(panel, head);
  host.append(panel);
  return panel;
}

function swatch(category: 'own' | 'other' | 'common', label: string, count: number): HTMLElement {
  const row = document.createElement('div');
  row.className = 'hcu-rc-legend-row';
  const mark = document.createElement('span');
  mark.className = `hcu-rc-swatch hcu-rc-swatch-${category}`;
  const text = document.createElement('span');
  text.textContent = label;
  const num = document.createElement('span');
  num.className = 'hcu-rc-count';
  num.textContent = String(count);
  row.append(mark, text, num);
  return row;
}

export function renderLegend(stats: ApplyStats, settings: Settings, onOpen: () => void): void {
  if (!inTopFrame() || !document.body) return;
  const panel = ensurePanel(ensureHost());
  const inner = panel.querySelector('.hcu-rc-body-inner');
  if (!inner) return;
  inner.replaceChildren();

  if (!settings.enabled) {
    const note = document.createElement('p');
    note.className = 'hcu-rc-note';
    note.textContent = '色分けはオフです。';
    inner.append(note);
  } else if (!settings.showLegend) {
    const note = document.createElement('p');
    note.className = 'hcu-rc-note';
    note.textContent = '凡例は隠しています。';
    inner.append(note);
  } else {
    const org = [settings.faculty, settings.department].filter(Boolean).join(' ') || '学科未設定';
    const who = document.createElement('p');
    who.className = 'hcu-rc-note';
    who.textContent = org;
    if (!settings.faculty && settings.department) {
      const inferred = resolvedFaculty(settings);
      if (inferred) who.textContent = `${inferred} ${settings.department}`;
    }
    inner.append(who);
    inner.append(swatch('own', CATEGORY_LABEL.own, stats.own));
    inner.append(swatch('other', CATEGORY_LABEL.other, stats.other));
    inner.append(swatch('common', CATEGORY_LABEL.common, stats.common));
    if (stats.unknown > 0) {
      const unknown = document.createElement('p');
      unknown.className = 'hcu-rc-note';
      unknown.textContent = `未判定 ${stats.unknown}`;
      inner.append(unknown);
    }
    if (stats.tables === 0 && stats.own + stats.other + stats.common === 0) {
      const empty = document.createElement('p');
      empty.className = 'hcu-rc-note';
      empty.textContent = '対象の一覧はまだ見当たりません。履修の追加やシラバス検索を開くと色が付きます。';
      inner.append(empty);
    }
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hcu-rc-open';
  button.textContent = '色分け設定';
  button.addEventListener('click', onOpen);
  inner.append(button);
}

export function removeLegend(): void {
  document.getElementById('hcu-rc-host')?.remove();
}
