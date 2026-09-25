import { classify, reasonLabel } from '../shared/classify';
import { normalize } from '../shared/normalize';
import type { CourseRecord, Settings } from '../shared/types';
import type { CourseCache } from './cache';
import { mergeRecords } from './cache';
import { findCourseRows, findTimetableCells, readPageContext } from './extract-dom';
import { clearMarked, applyCssVariables, paintCell, paintRow } from './paint';

export interface ApplyStats {
  own: number;
  other: number;
  common: number;
  unknown: number;
  tables: number;
}

export function applyColoring(root: ParentNode, settings: Settings, cache: CourseCache): ApplyStats {
  applyCssVariables(settings);
  const stats: ApplyStats = { own: 0, other: 0, common: 0, unknown: 0, tables: 0 };
  const seen = new Set<string>();
  const keep = new Set<HTMLElement>();
  const extracted = findCourseRows(root);
  stats.tables = new Set(extracted.map((item) => item.row.closest('table'))).size;

  const prepared = extracted.map((item) => {
    const scope = item.row.closest('form') ?? root;
    const context = item.inheritContext ? readPageContext(scope) : {};
    const record = cache.complete(mergeRecords(item.record, context));
    cache.add(record);
    return { row: item.row, record };
  });

  const count = (record: CourseRecord, category: ApplyStatsKey) => {
    const key = `${normalize(record.code ?? '')}|${normalize(record.name ?? '')}|${category}`;
    if ((record.code || record.name) && seen.has(key)) return;
    if (record.code || record.name) seen.add(key);
    stats[category] += 1;
  };

  for (const item of prepared) {
    const result = classify(item.record, settings);
    paintRow(item.row, result, settings, reasonLabel(result, settings));
    keep.add(item.row);
    count(item.record, result.category);
  }

  for (const cell of findTimetableCells(root)) {
    const loose = cache.lookupLooseName(cell.textContent ?? '');
    const record = loose ?? { name: (cell.textContent ?? '').replace(/\s+/g, ' ').trim() };
    const result = classify(record, settings);
    paintCell(cell, result, settings, reasonLabel(result, settings));
    keep.add(cell);
    count(record, result.category);
  }

  clearMarked(root, keep);
  return stats;
}

type ApplyStatsKey = 'own' | 'other' | 'common' | 'unknown';
