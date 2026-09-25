import { extractUnits } from '../shared/normalize';
import type { CourseRecord } from '../shared/types';
import { cellText, isTimetableTable, isUnitSummaryTable } from './extract-dom';
import { LIVE_PAGE } from './selectors';

const TAG = /^(必修|選択必修|複数回|後前|後後|前前|前後|前期|後期|集中)$/;
const CREDIT = /^\d+(?:\.\d+)?単位$/;

function isRealDepartment(name: string): boolean {
  return !/^(他|全学|共通)/.test(name);
}

function departmentUnits(text: string): string[] {
  const names = extractUnits(text)
    .filter((unit) => (unit.kind === '学科' || unit.kind === '専攻') && isRealDepartment(unit.name))
    .map((unit) => unit.name);
  return [...new Set(names)];
}

/** 科目名の括弧が学科・専攻そのもののときだけ返す。クラス名は返さない。 */
export function departmentFromParens(text: string): string | undefined {
  const folded = text
    .normalize('NFKC')
    .replace(/（\s*([^）]*?)\s*）/g, (_, inner: string) => `（${inner.replace(/\s+/g, '')}）`)
    .replace(/\(\s*([^)]*?)\s*\)/g, (_, inner: string) => `（${inner.replace(/\s+/g, '')}）`);
  const found: string[] = [];
  for (const match of folded.matchAll(/（([^）]{2,40})）/g)) {
    const inner = match[1] ?? '';
    if (/クラス|class/i.test(inner)) continue;
    const units = departmentUnits(inner);
    if (units.length === 0) continue;
    found.push(units.join(' '));
  }
  return found.length === 1 ? found[0] : undefined;
}

/** シラバスの履修対象・備考から学科を1つだけ取る。複数あるときは決めない。 */
export function pickDepartment(text: string): string | undefined {
  const compact = text.normalize('NFKC').replace(/\s+/g, '');
  if (!compact) return undefined;
  const only = compact.match(/([0-9A-Za-z\u30A0-\u30FF\u4E00-\u9FFFー]{2,30}?(?:学科|専攻))学生?のみ/);
  if (only?.[1]) {
    const units = departmentUnits(only[1]);
    const name = units[units.length - 1];
    if (name) return name;
  }
  const units = departmentUnits(compact);
  return units.length === 1 ? units[0] : undefined;
}

export function enrichOrgSignals(record: CourseRecord): CourseRecord {
  if (record.department || record.faculty) return record;
  const department = departmentFromParens(record.name ?? '') ?? pickDepartment(record.name ?? '');
  if (!department) return record;
  return { ...record, department };
}

function plainLines(cell: Element): string[] {
  const clone = cell.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('button, a, input, textarea, select, script, style, svg, img, .hcu-rc-badge').forEach((node) => node.remove());
  clone.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
  clone.querySelectorAll('div, p, li').forEach((node) => node.insertAdjacentText('afterend', '\n'));
  return (clone.textContent ?? '')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function isMetaLine(line: string): boolean {
  const compact = line.replace(/\s+/g, '');
  if (TAG.test(compact) || CREDIT.test(compact)) return true;
  return Boolean(compact.match(/^(\d{8})$/));
}

function looksLikeRoom(line: string): boolean {
  const text = line.normalize('NFKC');
  return /講[0-9]|情処|教室|実験室|体育館|演習室|\(\d+名\)/.test(text);
}

function looksLikePerson(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length > 30 || isMetaLine(trimmed) || looksLikeRoom(trimmed)) return false;
  return /^[\u4E00-\u9FFF\u30A0-\u30FFー]{1,12}\s+[\u4E00-\u9FFF\u30A0-\u30FFーA-Za-z]{1,16}$/.test(trimmed);
}

function parenOpen(text: string): boolean {
  const open = (text.match(/[（(]/g) ?? []).length;
  const close = (text.match(/[）)]/g) ?? []).length;
  return open > close;
}

function joinName(lines: string[]): string {
  if (lines.length === 0) return '';
  let name = lines[0] ?? '';
  for (const line of lines.slice(1)) {
    name += parenOpen(name) ? line : ` ${line}`;
  }
  return name
    .replace(/\s+/g, ' ')
    .replace(/（\s+/g, '（')
    .replace(/\s+）/g, '）')
    .trim();
}

export function parseCourseCell(cell: HTMLTableCellElement): CourseRecord | null {
  const lines = plainLines(cell);
  if (lines.length === 0) return null;
  const blob = lines.join('\n');
  const code = blob.match(LIVE_PAGE.courseCode)?.[1];
  const nameLines: string[] = [];
  for (const line of lines) {
    if (isMetaLine(line) || looksLikeRoom(line) || looksLikePerson(line)) break;
    const soFar = joinName(nameLines);
    if (soFar && !parenOpen(soFar) && /^[\u4E00-\u9FFF\u30A0-\u30FFー]{1,8}$/.test(line.replace(/\s+/g, '')) && !/学科|専攻|学部|共通|科目/.test(line)) {
      break;
    }
    nameLines.push(line);
  }
  const name = joinName(nameLines);
  if (!code && (!name || /^[+＋]?追加$/.test(name.replace(/\s+/g, '')))) return null;
  if (!code && /^[0-9０-９]{1,2}$/.test(name)) return null;
  const department = departmentFromParens(name);
  const record: CourseRecord = {};
  if (code) record.code = code;
  if (name) record.name = name;
  if (department) record.department = department;
  return record;
}

function weekdayTables(root: ParentNode): HTMLTableElement[] {
  const picked = new Set<HTMLTableElement>();
  const take = (table: Element) => {
    if (!(table instanceof HTMLTableElement) || !isTimetableTable(table) || isUnitSummaryTable(table)) return;
    if (table.closest(LIVE_PAGE.syllabusDialog)) return;
    picked.add(table);
  };
  root.querySelectorAll(LIVE_PAGE.semesterGroup).forEach((group) => {
    const label = group.getAttribute('aria-label') ?? '';
    if (!LIVE_PAGE.semesterLabel.test(label)) return;
    group.querySelectorAll('table').forEach(take);
  });
  root.querySelectorAll('table').forEach(take);
  return [...picked];
}

export function findRegistrationCourses(root: ParentNode): { cell: HTMLTableCellElement; record: CourseRecord }[] {
  const courses: { cell: HTMLTableCellElement; record: CourseRecord }[] = [];
  for (const table of weekdayTables(root)) {
    const header = table.tHead?.rows[0] ?? table.rows[0];
    for (const row of table.rows) {
      if (row === header) continue;
      for (const cell of row.cells) {
        if (!(cell instanceof HTMLTableCellElement)) continue;
        const record = parseCourseCell(cell);
        if (!record) continue;
        courses.push({ cell, record });
      }
    }
  }
  return courses;
}

function labelOf(cell: Element): string {
  return cellText(cell).replace(/\s+/g, '');
}

export function readSyllabusDialog(root: ParentNode): CourseRecord | null {
  const dialog = root.querySelector(LIVE_PAGE.syllabusDialog);
  if (!dialog) return null;
  const record: CourseRecord = {};
  const departmentText: string[] = [];
  dialog.querySelectorAll('tr').forEach((row) => {
    if (!(row instanceof HTMLTableRowElement)) return;
    const cells = [...row.cells];
    for (let index = 0; index + 1 < cells.length; index += 2) {
      const label = labelOf(cells[index]!);
      const value = cellText(cells[index + 1]!).replace(/\s+/g, ' ').trim();
      if (!label || !value) continue;
      if (/^(授業コード|科目コード)/.test(label) && !record.code) {
        record.code = value.match(LIVE_PAGE.courseCode)?.[1] ?? value.slice(0, 32);
      } else if (/^(科目名|授業科目)/.test(label) && !record.name) {
        record.name = value.slice(0, 200);
      } else if (/^担当/.test(label) && !record.instructor) {
        record.instructor = value.slice(0, 80);
      } else if (LIVE_PAGE.syllabusDepartmentLabels.test(label)) {
        departmentText.push(value);
      }
    }
  });
  const department = pickDepartment(departmentText.join('\n')) ?? departmentFromParens(record.name ?? '');
  if (department) record.department = department;
  if (!record.code && !record.name) return null;
  return record;
}
