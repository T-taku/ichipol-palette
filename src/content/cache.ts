import { normalize } from '../shared/normalize';
import type { CourseRecord } from '../shared/types';

export function mergeRecords(primary: CourseRecord, fallback: Partial<CourseRecord>): CourseRecord {
  const pick = (first?: string, second?: string) => {
    const left = first?.trim();
    if (left) return left;
    const right = second?.trim();
    return right || undefined;
  };
  return {
    code: pick(primary.code, fallback.code),
    name: pick(primary.name, fallback.name),
    instructor: pick(primary.instructor, fallback.instructor),
    department: pick(primary.department, fallback.department),
    faculty: pick(primary.faculty, fallback.faculty),
    division: pick(primary.division, fallback.division),
    commonFlag: primary.commonFlag || fallback.commonFlag || undefined,
  };
}

function trimRecord(record: CourseRecord): CourseRecord {
  const pick = (value?: string) => {
    const text = value?.trim().slice(0, 200);
    return text || undefined;
  };
  return {
    code: pick(record.code),
    name: pick(record.name),
    instructor: pick(record.instructor),
    department: pick(record.department),
    faculty: pick(record.faculty),
    division: pick(record.division),
    commonFlag: record.commonFlag || undefined,
  };
}

export interface CourseCache {
  add(record: CourseRecord): void;
  complete(record: CourseRecord): CourseRecord;
  lookupLooseName(text: string): CourseRecord | undefined;
  snapshot(): CourseRecord[];
  load(records: CourseRecord[]): void;
}

export function createCourseCache(): CourseCache {
  const byCode = new Map<string, CourseRecord>();
  const byName = new Map<string, CourseRecord>();

  const add = (record: CourseRecord) => {
    const clean = trimRecord(record);
    if (!clean.code && !clean.name) return;
    if (clean.code) {
      const key = normalize(clean.code);
      byCode.set(key, mergeRecords(clean, byCode.get(key) ?? {}));
    }
    if (clean.name) {
      const key = normalize(clean.name);
      byName.set(key, mergeRecords(clean, byName.get(key) ?? {}));
    }
  };

  return {
    add,
    complete(record) {
      const codeHit = record.code ? byCode.get(normalize(record.code)) : undefined;
      const nameHit = record.name ? byName.get(normalize(record.name)) : undefined;
      let next = record;
      if (codeHit) next = mergeRecords(next, codeHit);
      if (nameHit) next = mergeRecords(next, nameHit);
      return next;
    },
    lookupLooseName(text) {
      const key = normalize(text);
      if (!key) return undefined;
      const exact = byName.get(key);
      if (exact) return exact;
      let best: CourseRecord | undefined;
      let bestLength = 0;
      for (const [name, record] of byName) {
        if (name.length < 4 || name.length <= bestLength) continue;
        if (key.includes(name)) {
          best = record;
          bestLength = name.length;
        }
      }
      return best;
    },
    snapshot() {
      const seen = new Set<string>();
      const records: CourseRecord[] = [];
      for (const record of byCode.values()) {
        const id = `${record.code ?? ''}|${record.name ?? ''}`;
        if (seen.has(id)) continue;
        seen.add(id);
        records.push(record);
        if (records.length >= 400) break;
      }
      return records;
    },
    load(records) {
      for (const record of records) add(record);
    },
  };
}
