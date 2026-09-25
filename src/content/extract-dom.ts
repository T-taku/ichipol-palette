import type { CourseRecord } from '../shared/types';

export interface ExtractedRow {
  row: HTMLTableRowElement;
  record: CourseRecord;
  /** 表に開講学科・開講学部の列がないとき、同じ form の検索条件を補う。 */
  inheritContext: boolean;
}

type RecordField = 'code' | 'name' | 'instructor' | 'department' | 'faculty' | 'division';

const HEADER_FIELDS: { field: RecordField; patterns: RegExp[] }[] = [
  { field: 'code', patterns: [/授業コード/, /科目コード/, /講義コード/, /授業番号/, /^コード$/] },
  { field: 'name', patterns: [/授業科目名/, /授業科目/, /科目名/, /講義題目/, /講義名/, /^科目$/] },
  { field: 'instructor', patterns: [/担当教員/, /教員名/, /担当者/, /^教員$/, /^担当$/] },
  { field: 'department', patterns: [/開講学部.?学科/, /開講学科/, /学科組織/, /開講所属/, /開設学科/] },
  { field: 'faculty', patterns: [/^開講学部$/, /^開設学部$/] },
  { field: 'division', patterns: [/科目区分/, /授業管理部署/, /科目分類/, /授業区分/, /^区分$/] },
];

const DAY = /^(月|火|水|木|金|土|日)(曜日)?$/;
const IGNORE_VALUE = /^(すべて|全て|指定なし|未選択|選択してください|----|---|―|なし|未設定)$/;

export function cellText(cell: Element): string {
  const clone = cell.cloneNode(true) as Element;
  clone.querySelectorAll('.hcu-rc-badge, script, style').forEach((node) => node.remove());
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function matchHeader(text: string): { field: RecordField; score: number } | null {
  const compact = text.replace(/\s+/g, '');
  let best: { field: RecordField; score: number } | null = null;
  for (const spec of HEADER_FIELDS) {
    for (const pattern of spec.patterns) {
      if (!pattern.test(compact)) continue;
      const score = pattern.source.length;
      if (!best || score > best.score) best = { field: spec.field, score };
    }
  }
  return best;
}

export function isTimetableTable(table: HTMLTableElement): boolean {
  const header = table.tHead?.rows[0] ?? table.rows[0];
  if (!header) return false;
  const days = [...header.cells]
    .map((cell) => cellText(cell).replace(/\s+/g, ''))
    .filter((text) => DAY.test(text));
  return days.length >= 3;
}

function mapTable(table: HTMLTableElement): ExtractedRow[] | null {
  let headerRow: HTMLTableRowElement | null = null;
  let bestScore = 0;
  const candidates = table.tHead ? [...table.tHead.rows] : [...table.rows].slice(0, 2);
  for (const row of candidates) {
    const score = [...row.cells].reduce((sum, cell) => sum + (matchHeader(cellText(cell)) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      headerRow = row;
    }
  }
  if (!headerRow || bestScore < 2) return null;

  const columns = new Map<RecordField, number>();
  [...headerRow.cells].forEach((cell, index) => {
    const matched = matchHeader(cellText(cell));
    if (!matched || columns.has(matched.field)) return;
    columns.set(matched.field, index);
  });
  if (!columns.has('name') && !columns.has('code')) return null;

  const inheritContext = !columns.has('department') && !columns.has('faculty');
  const bodyRows = table.tBodies.length
    ? [...table.tBodies].flatMap((body) => [...body.rows])
    : [...table.rows].filter((row) => row !== headerRow);

  const extracted: ExtractedRow[] = [];
  for (const row of bodyRows) {
    if (row === headerRow || row.cells.length < 2) continue;
    const record: CourseRecord = {};
    for (const [field, index] of columns) {
      const cell = row.cells[index];
      if (!cell) continue;
      const text = cellText(cell);
      if (!text) continue;
      record[field] = text;
      if (field === 'name') cell.dataset.hcuName = '1';
    }
    if (!record.name && !record.code) continue;
    extracted.push({ row, record, inheritContext });
  }
  return extracted;
}

export function findCourseRows(root: ParentNode): ExtractedRow[] {
  const rows: ExtractedRow[] = [];
  root.querySelectorAll('table').forEach((table) => {
    if (!(table instanceof HTMLTableElement) || isTimetableTable(table)) return;
    const mapped = mapTable(table);
    if (mapped) rows.push(...mapped);
  });
  return rows;
}

export function findTimetableCells(root: ParentNode): HTMLTableCellElement[] {
  const cells: HTMLTableCellElement[] = [];
  root.querySelectorAll('table').forEach((table) => {
    if (!(table instanceof HTMLTableElement) || !isTimetableTable(table)) return;
    const header = table.tHead?.rows[0] ?? table.rows[0];
    for (const row of table.rows) {
      if (row === header) continue;
      for (const cell of row.cells) {
        const text = cellText(cell);
        if (text.length < 2 || text.length > 80) continue;
        if (DAY.test(text.replace(/\s+/g, '')) || /^[0-9０-９]+$/.test(text)) continue;
        cells.push(cell);
      }
    }
  });
  return cells;
}

function directLabelText(label: Element): string {
  const parts: string[] = [];
  for (const node of label.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) parts.push(node.textContent ?? '');
  }
  const direct = parts.join('').replace(/\s+/g, '');
  if (direct) return direct;
  return (label.textContent ?? '').replace(/\s+/g, '').slice(0, 40);
}

function matchContextField(label: string): 'department' | 'faculty' | 'division' | null {
  if (/授業管理部署|科目区分|科目分類/.test(label)) return 'division';
  if (/学科組織|開講学科|開講学部.?学科|開講所属/.test(label)) return 'department';
  if (/開講学部|開設学部/.test(label)) return 'faculty';
  return null;
}

function controlValue(element: Element): string {
  if (element instanceof HTMLSelectElement) {
    return (element.selectedOptions[0]?.textContent ?? element.value).replace(/\s+/g, ' ').trim();
  }
  if (element instanceof HTMLInputElement) {
    if (element.type === 'hidden' || element.type === 'checkbox' || element.type === 'radio') return '';
    return element.value.trim();
  }
  if (element.classList.contains('ui-selectonemenu-label')) {
    return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
  const inner = element.querySelector('.ui-selectonemenu-label');
  if (inner) return (inner.textContent ?? '').replace(/\s+/g, ' ').trim();
  return '';
}

function valueNearLabel(label: Element): string {
  const forId = label.getAttribute('for');
  if (forId) {
    const control = label.ownerDocument?.getElementById(forId);
    const value = control ? controlValue(control) : '';
    if (value) return value;
  }
  const parentControl = label.parentElement?.querySelector('select, input, .ui-selectonemenu-label');
  if (parentControl && parentControl !== label) {
    const value = controlValue(parentControl);
    if (value) return value;
  }
  const next = label.nextElementSibling;
  if (!next) return '';
  return controlValue(next);
}

export function readPageContext(scope: ParentNode): Partial<CourseRecord> {
  const found: Partial<CourseRecord> = {};
  scope.querySelectorAll('label, .ui-outputlabel').forEach((label) => {
    const field = matchContextField(directLabelText(label));
    if (!field || found[field]) return;
    const value = valueNearLabel(label);
    if (!value || IGNORE_VALUE.test(value.replace(/\s+/g, ''))) return;
    found[field] = value;
  });
  return found;
}

const LABEL_FIELD: { field: RecordField; pattern: RegExp }[] = [
  { field: 'code', pattern: /^(授業コード|科目コード|講義コード)$/ },
  { field: 'name', pattern: /^(授業科目|授業科目名|科目名|講義題目)$/ },
  { field: 'instructor', pattern: /^(担当教員|教員名|担当者)$/ },
  { field: 'department', pattern: /^(開講学科|学科組織|開講所属)$/ },
  { field: 'faculty', pattern: /^(開講学部|開設学部)$/ },
  { field: 'division', pattern: /^(科目区分|授業管理部署|科目分類)$/ },
];

/** シラバス詳細のような「項目名 + 値」の2列から、科目を1件取り出す。 */
export function extractLabeledRecord(root: ParentNode): CourseRecord | null {
  const skip = new Set(findCourseRows(root).map((item) => item.row));
  const record: CourseRecord = {};
  root.querySelectorAll('tr').forEach((tr) => {
    if (!(tr instanceof HTMLTableRowElement) || skip.has(tr) || tr.cells.length < 2) return;
    const label = cellText(tr.cells[0]).replace(/\s+/g, '');
    const value = cellText(tr.cells[1]);
    if (!label || !value || label.length > 30 || value.length > 160) return;
    const field = LABEL_FIELD.find((item) => item.pattern.test(label))?.field;
    if (!field || record[field]) return;
    record[field] = value;
  });
  if (!record.name && !record.code) return null;
  if (!record.department && !record.faculty && !record.division) return null;
  return record;
}
