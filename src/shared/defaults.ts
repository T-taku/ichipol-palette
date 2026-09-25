import { normalizeHex } from './color';
import { departmentsFor, isPresetFaculty } from './org';
import { inferFaculty } from './classify-faculty';
import type { CourseCategory, OverrideRule, Settings } from './types';

export const DEFAULT_COLORS: Record<CourseCategory, string> = {
  own: '#d7f3e3',
  other: '#fde7c7',
  common: '#d9e7fb',
};

export function defaultSettings(): Settings {
  return {
    version: 1,
    enabled: true,
    showLegend: true,
    showBadges: true,
    treatFacultyWideAsOwn: true,
    allowSameOriginLookup: false,
    faculty: '',
    department: '',
    colors: { ...DEFAULT_COLORS },
    rules: [],
  };
}

export function createRuleId(): string {
  return `r-${Math.random().toString(36).slice(2, 10)}`;
}

const CATEGORIES = new Set<CourseCategory>(['own', 'other', 'common']);
const FIELDS = new Set<OverrideRule['field']>(['name', 'code', 'department', 'division', 'any']);
const MATCHES = new Set<OverrideRule['match']>(['includes', 'equals', 'prefix', 'regex']);

function sanitizeRule(input: unknown): OverrideRule | null {
  if (!input || typeof input !== 'object') return null;
  const rule = input as Partial<OverrideRule>;
  if (!rule.field || !FIELDS.has(rule.field)) return null;
  if (!rule.match || !MATCHES.has(rule.match)) return null;
  if (!rule.category || !CATEGORIES.has(rule.category)) return null;
  const pattern = typeof rule.pattern === 'string' ? rule.pattern.slice(0, 80) : '';
  return {
    id: typeof rule.id === 'string' && rule.id ? rule.id.slice(0, 40) : createRuleId(),
    enabled: rule.enabled !== false,
    field: rule.field,
    match: rule.match,
    pattern,
    category: rule.category,
  };
}

export function sanitizeSettings(input: unknown): Settings {
  const base = defaultSettings();
  if (!input || typeof input !== 'object') return base;
  const raw = input as Partial<Settings>;
  const colors = { ...base.colors };
  if (raw.colors && typeof raw.colors === 'object') {
    for (const key of ['own', 'other', 'common'] as const) {
      const next = normalizeHex(String(raw.colors[key] ?? ''));
      if (next) colors[key] = next;
    }
  }
  const faculty = typeof raw.faculty === 'string' ? raw.faculty.trim().slice(0, 40) : '';
  const department = typeof raw.department === 'string' ? raw.department.trim().slice(0, 40) : '';
  const rules = Array.isArray(raw.rules)
    ? raw.rules.map(sanitizeRule).filter((rule): rule is OverrideRule => rule !== null).slice(0, 40)
    : [];
  return {
    version: 1,
    enabled: raw.enabled !== false,
    showLegend: raw.showLegend !== false,
    showBadges: raw.showBadges !== false,
    treatFacultyWideAsOwn: raw.treatFacultyWideAsOwn !== false,
    allowSameOriginLookup: raw.allowSameOriginLookup === true,
    faculty,
    department,
    colors,
    rules,
  };
}

export function resolvedFaculty(settings: Settings): string {
  const faculty = settings.faculty.trim();
  if (faculty) return faculty;
  return inferFaculty(settings.department) ?? '';
}

export function departmentChoices(faculty: string): readonly string[] {
  if (!isPresetFaculty(faculty)) return [];
  return departmentsFor(faculty);
}
