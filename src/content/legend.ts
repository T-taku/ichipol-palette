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

function ensureHost(): HTMLElement {
  const existing = document.getElementById('hcu-rc-host');
  if (existing) return existing;
  const host = document.createElement('div');
  host.id = 'hcu-rc-host';
  document.body.appendChild(host);
  return host;
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
  const host = ensureHost();
  host.replaceChildren();

  const panel = document.createElement('aside');
  panel.className = 'hcu-rc-panel';
  panel.setAttribute('aria-label', '履修カラー');

  const title = document.createElement('p');
  title.className = 'hcu-rc-title';
  title.textContent = '履修カラー';
  panel.append(title);

  if (!settings.enabled) {
    const note = document.createElement('p');
    note.className = 'hcu-rc-note';
    note.textContent = '色分けはオフです。';
    panel.append(note);
  } else if (!settings.showLegend) {
    const note = document.createElement('p');
    note.className = 'hcu-rc-note';
    note.textContent = '凡例は隠しています。';
    panel.append(note);
  } else {
    const org = [settings.faculty, settings.department].filter(Boolean).join(' ') || '学科未設定';
    const who = document.createElement('p');
    who.className = 'hcu-rc-note';
    who.textContent = org;
    if (!settings.faculty && settings.department) {
      const inferred = resolvedFaculty(settings);
      if (inferred) who.textContent = `${inferred} ${settings.department}`;
    }
    panel.append(who);
    panel.append(swatch('own', CATEGORY_LABEL.own, stats.own));
    panel.append(swatch('other', CATEGORY_LABEL.other, stats.other));
    panel.append(swatch('common', CATEGORY_LABEL.common, stats.common));
    if (stats.unknown > 0) {
      const unknown = document.createElement('p');
      unknown.className = 'hcu-rc-note';
      unknown.textContent = `未判定 ${stats.unknown}`;
      panel.append(unknown);
    }
    if (stats.tables === 0 && stats.own + stats.other + stats.common === 0) {
      const empty = document.createElement('p');
      empty.className = 'hcu-rc-note';
      empty.textContent = '対象の一覧はまだ見当たりません。履修の追加やシラバス検索を開くと色が付きます。';
      panel.append(empty);
    }
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hcu-rc-open';
  button.textContent = '色分け設定';
  button.addEventListener('click', onOpen);
  panel.append(button);
  host.append(panel);
}

export function removeLegend(): void {
  document.getElementById('hcu-rc-host')?.remove();
}
