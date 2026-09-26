import { classify, reasonLabel } from '../shared/classify';
import { normalize } from '../shared/normalize';
import type { CourseRecord, Settings } from '../shared/types';
import type { CourseCache } from './cache';
import { mergeRecords } from './cache';
import { findCourseRows, readPageContext } from './extract-dom';
import { clearMarked, applyCssVariables, paintCell, paintRow } from './paint';
import { enrichOrgSignals, findRegistrationCourses, readSyllabusDialog } from './registration';
import { applyCatalog, bundledCatalog, type CourseCatalog } from './syllabus-lookup';

export interface ApplyStats {
  own: number;
  other: number;
  common: number;
  unknown: number;
  tables: number;
}

export function applyColoring(
  root: ParentNode,
  settings: Settings,
  cache: CourseCache,
  catalog: CourseCatalog = bundledCatalog,
): ApplyStats {
  applyCssVariables(settings);
  const stats: ApplyStats = { own: 0, other: 0, common: 0, unknown: 0, tables: 0 };
  const seen = new Set<string>();
  const keep = new Set<HTMLElement>();
  const dialog = readSyllabusDialog(root);
  if (dialog) cache.add(dialog);

  const extracted = findCourseRows(root);
  const timetable = findRegistrationCourses(root);
  stats.tables = new Set(
    [...extracted.map((item) => item.row.closest('table')), ...timetable.map((item) => item.cell.closest('table'))].filter(
      (table): table is HTMLTableElement => table instanceof HTMLTableElement,
    ),
  ).size;

  const prepared = extracted.map((item) => {
    const scope = item.row.closest('form') ?? root;
    const context = item.inheritContext ? readPageContext(scope) : {};
    const record = applyCatalog(cache.complete(mergeRecords(enrichOrgSignals(item.record), context)), catalog);
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
    paintRow(item.row, result, settings, reasonLabel(result, settings, item.record));
    keep.add(item.row);
    count(item.record, result.category);
  }

  for (const item of timetable) {
    let record = applyCatalog(cache.complete(enrichOrgSignals(item.record)), catalog);
    if (!record.department && !record.faculty && !record.division && !record.commonFlag && record.name) {
      const loose = cache.lookupLooseName(record.name);
      if (loose) record = mergeRecords(record, loose);
    }
    cache.add(record);
    const result = classify(record, settings);
    paintCell(item.cell, result, settings, reasonLabel(result, settings, record));
    keep.add(item.cell);
    count(record, result.category);
  }

  clearMarked(root, keep);
  return stats;
}

type ApplyStatsKey = 'own' | 'other' | 'common' | 'unknown';
