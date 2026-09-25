import catalogFile from '../../data/courses-2026-kouki.json';
import { normalize } from '../shared/normalize';
import type { CourseRecord } from '../shared/types';

export type CatalogCategory = 'common' | 'faculty';

export interface CatalogCourse {
  name?: string;
  type?: string;
  category: CatalogCategory;
  faculty?: string | null;
}

/** 年度・学期ごとの静的索引。実行時にシラバスへ取りにいかない。 */
export interface CourseCatalog {
  year: number;
  term: string;
  updated?: string;
  source?: string;
  counts?: Record<string, number>;
  courses: Record<string, CatalogCourse>;
}

export const bundledCatalog = catalogFile as CourseCatalog;

export function courseKey(code: string): string {
  return normalize(code).toUpperCase();
}

const indexes = new WeakMap<CourseCatalog, Map<string, CatalogCourse>>();

function indexOf(catalog: CourseCatalog): Map<string, CatalogCourse> {
  const cached = indexes.get(catalog);
  if (cached) return cached;
  const map = new Map<string, CatalogCourse>();
  for (const [code, course] of Object.entries(catalog.courses)) {
    map.set(courseKey(code), course);
  }
  indexes.set(catalog, map);
  return map;
}

export function lookupCourse(code: string | undefined, catalog: CourseCatalog = bundledCatalog): CatalogCourse | undefined {
  if (!code) return undefined;
  return indexOf(catalog).get(courseKey(code));
}

function catalogFaculty(course: CatalogCourse): string | undefined {
  const faculty = course.faculty?.trim();
  return faculty || undefined;
}

/** 索引の科目名に学科が一つだけ書かれていれば、それを開講学科にする。クラス名は学科にしない。 */
function departmentInTitle(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const source = normalize(name);
  const re = /([0-9A-Za-z\u30A0-\u30FF\u4E00-\u9FFFー]{2,40}?)(学科|専攻)/g;
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const found = match[1] + match[2];
    if (/^(他|全学|共通)/.test(found)) continue;
    if (!names.includes(found)) names.push(found);
  }
  return names.length === 1 ? names[0] : undefined;
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
    faculty: catalogFaculty(hit) ?? record.faculty,
    department: departmentInTitle(hit.name),
    catalogCategory: 'faculty',
    catalogFaculty: catalogFaculty(hit),
    commonFlag: false,
  };
}
