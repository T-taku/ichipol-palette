import { darken, textOn } from '../shared/color';
import { CATEGORY_LABEL, type Classification, type CourseCategory, type Settings } from '../shared/types';
import { cellText } from './extract-dom';

const ROW_CLASSES = ['hcu-rc-row', 'hcu-rc-own', 'hcu-rc-other', 'hcu-rc-common'] as const;

export function applyCssVariables(settings: Settings): void {
  const root = document.documentElement;
  for (const key of ['own', 'other', 'common'] as const) {
    root.style.setProperty(`--hcu-${key}`, settings.colors[key]);
    root.style.setProperty(`--hcu-${key}-bar`, darken(settings.colors[key], 0.38));
    root.style.setProperty(`--hcu-${key}-fg`, textOn(settings.colors[key]));
  }
}

function signature(target: Element, result: Classification, settings: Settings): string {
  return [
    settings.enabled ? '1' : '0',
    result.category,
    result.reason,
    settings.colors.own,
    settings.colors.other,
    settings.colors.common,
    settings.showBadges ? '1' : '0',
    cellText(target).slice(0, 180),
  ].join('|');
}

function clearElement(element: HTMLElement): void {
  element.classList.remove(...ROW_CLASSES, 'hcu-rc-cell');
  delete element.dataset.hcuCat;
  element.removeAttribute('title');
  element.querySelectorAll(':scope > .hcu-rc-badge, .hcu-rc-badge').forEach((node) => {
    if (element.contains(node)) node.remove();
  });
}

function paint(element: HTMLElement, result: Classification, settings: Settings, title: string, cell: boolean): void {
  const sig = signature(element, result, settings);
  if (element.dataset.hcuSig === sig) return;
  clearElement(element);
  element.dataset.hcuSig = sig;
  if (!settings.enabled) return;
  element.title = title;
  if (result.category === 'unknown') return;

  const category: CourseCategory = result.category;
  element.classList.add(cell ? 'hcu-rc-cell' : 'hcu-rc-row', `hcu-rc-${category}`);
  element.dataset.hcuCat = category;

  if (!settings.showBadges) return;
  const host = element.querySelector('[data-hcu-name]') ?? (element instanceof HTMLTableRowElement ? element.cells[0] : element);
  if (!host) return;
  const badge = document.createElement('span');
  badge.className = `hcu-rc-badge hcu-rc-badge-${category}`;
  badge.textContent = CATEGORY_LABEL[category];
  host.appendChild(badge);
}

export function paintRow(row: HTMLTableRowElement, result: Classification, settings: Settings, title: string): void {
  paint(row, result, settings, title, false);
}

export function paintCell(cell: HTMLTableCellElement, result: Classification, settings: Settings, title: string): void {
  paint(cell, result, settings, title, true);
}

export function clearMarked(root: ParentNode, keep: Set<HTMLElement>): void {
  root.querySelectorAll<HTMLElement>('tr[data-hcu-sig], td[data-hcu-sig]').forEach((element) => {
    if (keep.has(element)) return;
    clearElement(element);
    delete element.dataset.hcuSig;
  });
}
