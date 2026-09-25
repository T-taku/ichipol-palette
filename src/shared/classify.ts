import { COMMON_TEXT_PATTERNS } from '../content/selectors';
import { resolvedFaculty } from './defaults';
import { departmentMatches, facultyMatches, hasSpecificDepartment, normalize } from './normalize';
import type { Classification, CourseRecord, OverrideRule, Settings } from './types';

/**
 * 判定の順序:
 * 1. 設定の上書きルール（先に書いてあるものが優先）
 * 2. 共通・教養・全学共通などの標識（「学部共通」は全学共通にしない）
 * 3. 開講学科がユーザの学科と一致 → 自学科
 * 4. 学科名がなく、ユーザの学部だけの開講 → 設定次第で自学科
 * 5. 開講所属が取れて一致しない → 他学科
 * 6. 所属が取れない、またはユーザ未設定 → 未判定（色を付けない）
 *
 * 広島市立大学の教育課程では、全学共通系科目・外国語系科目は学部専門とは別枠
 * （学修の手引き）。ここでの「共通」はその枠を指す。
 * 共通科目の文言は `src/content/selectors.ts` の COMMON_TEXT_PATTERNS。
 */

function ruleText(record: CourseRecord, field: OverrideRule['field']): string {
  switch (field) {
    case 'name':
      return record.name ?? '';
    case 'code':
      return record.code ?? '';
    case 'department':
      return [record.department, record.faculty].filter(Boolean).join(' ');
    case 'division':
      return record.division ?? '';
    case 'any':
      return [record.name, record.code, record.department, record.faculty, record.division].filter(Boolean).join('\n');
  }
}

export function ruleMatches(rule: OverrideRule, record: CourseRecord): boolean {
  if (!rule.enabled) return false;
  const pattern = rule.pattern.trim();
  if (!pattern) return false;
  const text = ruleText(record, rule.field);
  const normalizedText = normalize(text);
  const normalizedPattern = normalize(pattern);
  switch (rule.match) {
    case 'includes':
      return normalizedText.includes(normalizedPattern);
    case 'equals':
      return normalizedText === normalizedPattern;
    case 'prefix':
      return normalizedText.startsWith(normalizedPattern);
    case 'regex':
      try {
        return new RegExp(pattern, 'u').test(text);
      } catch {
        return false;
      }
  }
}

export function isCommonCourse(record: CourseRecord): boolean {
  if (record.commonFlag && !/学部共通/.test(record.division ?? '')) return true;
  const blob = [record.name, record.department, record.faculty, record.division].filter(Boolean).join(' ');
  if (!blob) return false;
  return COMMON_TEXT_PATTERNS.some((pattern) => pattern.test(blob));
}

function orgBlob(record: CourseRecord): string {
  return [record.department, record.faculty].filter(Boolean).join(' ');
}

export function classify(record: CourseRecord, settings: Settings): Classification {
  const rule = settings.rules.find((item) => ruleMatches(item, record));
  if (rule) return { category: rule.category, reason: 'rule', ruleId: rule.id };

  if (isCommonCourse(record)) return { category: 'common', reason: 'common-tag' };

  const userDepartment = settings.department.trim();
  const userFaculty = resolvedFaculty(settings);
  const blob = orgBlob(record);
  const userConfigured = Boolean(userDepartment || settings.faculty.trim());

  if (userDepartment && blob && departmentMatches(blob, userDepartment)) {
    return { category: 'own', reason: 'department' };
  }

  const wide = Boolean(userFaculty && blob && facultyMatches(blob, userFaculty) && !hasSpecificDepartment(blob));
  if (wide) {
    if (settings.treatFacultyWideAsOwn) return { category: 'own', reason: 'faculty-wide' };
    if (userConfigured) return { category: 'other', reason: 'mismatch' };
  }

  if (blob) {
    if (!userConfigured) return { category: 'unknown', reason: 'user-unset' };
    return { category: 'other', reason: 'mismatch' };
  }

  if (!userConfigured) return { category: 'unknown', reason: 'user-unset' };
  return { category: 'unknown', reason: 'no-metadata' };
}

export function reasonLabel(result: Classification, settings: Settings): string {
  switch (result.reason) {
    case 'rule':
      return '上書きルールに一致';
    case 'common-tag':
      return '共通・教養・全学共通として判定';
    case 'department':
      return `開講学科が「${settings.department}」と一致`;
    case 'faculty-wide':
      return `「${resolvedFaculty(settings) || '同じ学部'}」の学部開講として判定`;
    case 'mismatch':
      return '開講所属が自分の学科と異なる';
    case 'user-unset':
      return '学科が未設定のため未判定';
    case 'no-metadata':
      return '開講学科がページ上に見当たらないため未判定';
  }
}
