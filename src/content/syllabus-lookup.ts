import catalogFile from '../../data/courses-2026.json';
import { normalize } from '../shared/normalize';
import type { CourseRecord } from '../shared/types';

export type CatalogCategory = 'common' | 'faculty';

export interface CatalogCourse {
  name?: string;
  type?: string;
  category: CatalogCategory;
  faculty?: string;
}

/** 年度ごとの静的索引。実行時にシラバスへ取りにいかない。 */
export interface CourseCatalog {
  year: number;
  term: string;
  updated: string;
  courses: Record<string, CatalogCourse>;
}

export const bundledCatalog = catalogFile as CourseCatalog;

export function courseKey(code: string): string {
  return normalize(code).toUpperCase();
}

export function lookupCourse(code: string | undefined, catalog: CourseCatalog = bundledCatalog): CatalogCourse | undefined {
  if (!code) return undefined;
  return catalog.courses[courseKey(code)];
}

/** 授業コードが索引にあれば、その共通・学部をセルより優先する。無いコードはそのまま。 */
export function applyCatalog(record: CourseRecord, catalog: CourseCatalog = bundledCatalog): CourseRecord {
  const hit = lookupCourse(record.code, catalog);
  if (!hit) return record;
  const name = record.name?.trim() || hit.name;
  if (hit.category === 'common') {
    return {
      ...record,
      name,
      division: hit.type ?? record.division,
      catalogCategory: 'common',
      catalogFaculty: undefined,
      commonFlag: true,
    };
  }
  return {
    ...record,
    name,
    division: hit.type ?? record.division,
    faculty: hit.faculty ?? record.faculty,
    department: undefined,
    catalogCategory: 'faculty',
    catalogFaculty: hit.faculty,
    commonFlag: false,
  };
}
