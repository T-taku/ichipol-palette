export type CourseCategory = 'own' | 'other' | 'common';

export type ClassificationReason =
  | 'rule'
  | 'common-tag'
  | 'department'
  | 'faculty-wide'
  | 'mismatch'
  | 'user-unset'
  | 'no-metadata';

export interface CourseRecord {
  code?: string;
  name?: string;
  instructor?: string;
  department?: string;
  faculty?: string;
  division?: string;
  commonFlag?: boolean;
  /** 同梱の年度索引。セルの文言より先に使う。 */
  catalogCategory?: 'common' | 'faculty';
  catalogFaculty?: string;
}

export interface Classification {
  category: CourseCategory | 'unknown';
  reason: ClassificationReason;
  ruleId?: string;
}

export type RuleField = 'name' | 'code' | 'department' | 'division' | 'any';
export type RuleMatch = 'includes' | 'equals' | 'prefix' | 'regex';

export interface OverrideRule {
  id: string;
  enabled: boolean;
  field: RuleField;
  match: RuleMatch;
  pattern: string;
  category: CourseCategory;
}

export interface Settings {
  version: 1;
  enabled: boolean;
  showLegend: boolean;
  showBadges: boolean;
  treatFacultyWideAsOwn: boolean;
  allowSameOriginLookup: boolean;
  faculty: string;
  department: string;
  colors: Record<CourseCategory, string>;
  rules: OverrideRule[];
}

export const CATEGORY_LABEL: Record<CourseCategory, string> = {
  own: '自学科',
  other: '他学科',
  common: '共通',
};
