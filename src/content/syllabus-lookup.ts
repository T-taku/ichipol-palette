import { normalize } from '../shared/normalize';
import { isUnipaUrl } from '../shared/hosts';
import type { CourseRecord } from '../shared/types';
import { mergeRecords } from './cache';

/**
 * いちぽるのゲストシラバス入口。第三者のサーバは使わない。
 * ログイン済み履修登録とは別セッションになり得るので、項目が分かるまで開かない。
 */
export const GUEST_SYLLABUS_ENTRY =
  'https://ichipol.g.hiroshima-cu.ac.jp/uprx/up/pk/pky001/Pky00101.xhtml?guestlogin=Kmh006';

export const SYLLABUS_MAP_KEY = 'hcu-rishu-syllabus-map';

const MAX_ENTRIES = 4000;

export type SyllabusKind = 'common' | 'faculty';

export interface SyllabusEntry {
  code: string;
  name?: string;
  department?: string;
  faculty?: string;
  division?: string;
  /** 科目授業種別の原文。例: 全学共通科目、情報科学部専門科目 */
  rawType?: string;
  kind?: SyllabusKind;
  commonFlag?: boolean;
}

export interface SyllabusMapFile {
  version: 1;
  source: string;
  byCode: Record<string, SyllabusEntry>;
}

export type SyllabusRefreshResult =
  | { ok: true; added: number }
  | { ok: false; reason: 'open-guest-page' | 'host-rejected' };

/**
 * ゲスト検索の項目は実測済み。種別は結果の列ではなく「科目授業種別」の選択値。
 * JSF の ViewState は画面ごとに変わるので、ここから POST はしない。
 * 開いた検索結果の表を `ingestGuestDocument` が読む。
 */
export const GUEST_FIELDS_READY = true;

const MODALITY = /^(講義|演習|実験|実習|実技)$/;

/** 科目授業種別の表示文を、共通か学部専門かに分ける。講義などの実施形態は分類にしない。 */
export function classifySubjectType(raw: string): { kind: SyllabusKind; faculty?: string; rawType: string } | null {
  const text = raw.normalize('NFKC').replace(/\s+/g, '');
  if (!text || text === 'すべて対象' || text === '指定なし' || MODALITY.test(text)) return null;
  if (text.includes('全学共通')) return { kind: 'common', rawType: text };
  if (text.includes('単位互換')) return null;
  const faculty = text.match(/(.+?(?:学部|研究科))/);
  if (faculty?.[1] && text.includes('専門')) return { kind: 'faculty', faculty: faculty[1], rawType: text };
  return null;
}

function codeKey(code: string): string {
  return normalize(code).toUpperCase();
}

function asEntry(record: CourseRecord): SyllabusEntry | null {
  const code = record.code?.trim() ?? '';
  if (!/^[0-9][0-9A-Z]{5,11}$/.test(codeKey(code))) return null;
  const entry: SyllabusEntry = { code: codeKey(code) };
  const text = (value?: string) => value?.trim().slice(0, 200) || '';
  const name = text(record.name);
  const department = text(record.department);
  const faculty = text(record.faculty);
  const division = text(record.division);
  if (name) entry.name = name;
  if (department) entry.department = department;
  if (faculty) entry.faculty = faculty;
  if (division) entry.division = division;
  const rawType = text((record as CourseRecord & { rawType?: string }).rawType) || (division && classifySubjectType(division)?.rawType);
  if (rawType) entry.rawType = rawType;
  const kind = classifySubjectType(rawType || division || '')?.kind;
  if (kind) entry.kind = kind;
  entry.commonFlag = record.commonFlag === true || kind === 'common';
  if (kind === 'faculty') entry.commonFlag = false;
  return entry;
}

function sanitizeMap(input: unknown): SyllabusMapFile {
  const byCode: Record<string, SyllabusEntry> = {};
  const raw = input && typeof input === 'object' ? (input as { byCode?: unknown }).byCode : undefined;
  if (raw && typeof raw === 'object') {
    for (const value of Object.values(raw as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const entry = asEntry(value as CourseRecord);
      if (!entry) continue;
      byCode[entry.code] = { ...byCode[entry.code], ...entry, code: entry.code };
      if (Object.keys(byCode).length >= MAX_ENTRIES) break;
    }
  }
  return { version: 1, source: GUEST_SYLLABUS_ENTRY, byCode };
}

/** ゲストシラバス取得は ichipol.g の /uprx/ だけ。 */
export function allowSyllabusFetch(url: string): boolean {
  if (!isUnipaUrl(url)) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'ichipol.g.hiroshima-cu.ac.jp' && parsed.pathname.includes('/uprx/');
  } catch {
    return false;
  }
}

function localStore(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** 授業コードから、ゲストシラバスで控えた学部・学科・共通を引く。 */
export class SyllabusLookup {
  static readonly FIELDS_READY = GUEST_FIELDS_READY;

  private byCode = new Map<string, SyllabusEntry>();

  get size(): number {
    return this.byCode.size;
  }

  remember(records: readonly CourseRecord[]): number {
    let added = 0;
    for (const record of records) {
      const entry = asEntry(record);
      if (!entry) continue;
      const prev = this.byCode.get(entry.code);
      this.byCode.set(entry.code, { ...prev, ...entry, code: entry.code });
      added += 1;
      if (this.byCode.size > MAX_ENTRIES) {
        const oldest = this.byCode.keys().next().value;
        if (oldest) this.byCode.delete(oldest);
      }
    }
    return added;
  }

  /** セルに書かれた学科は残す。索引は学部・共通の空きを埋める。 */
  complete(record: CourseRecord): CourseRecord {
    const key = record.code ? codeKey(record.code) : '';
    if (!key) return record;
    const hit = this.byCode.get(key);
    if (!hit) return record;
    const merged = mergeRecords(record, {
      code: hit.code,
      name: hit.name,
      department: hit.department,
      faculty: hit.kind === 'common' ? undefined : hit.faculty,
      division: hit.rawType ?? hit.division,
      commonFlag: hit.kind === 'common' ? true : undefined,
    });
    if (hit.kind === 'common') merged.commonFlag = true;
    return merged;
  }

  absorb(records: readonly CourseRecord[]): boolean {
    const before = this.fingerprint();
    this.remember(records);
    return this.fingerprint() !== before;
  }

  /**
   * ゲストシラバス検索の結果表を読む。
   * 種別は各行には無く、検索条件「科目授業種別」の選択値を、見えている授業コード全部に付ける。
   * 詳細ダイアログに開講学部・学科は無い。
   */
  ingestGuestDocument(root: ParentNode): CourseRecord[] {
    const rawType = readFilterValue(root, /科目授業種別/);
    const typed = classifySubjectType(rawType);
    if (!typed) return [];
    const records: CourseRecord[] = [];
    root.querySelectorAll('table').forEach((table) => {
      if (!(table instanceof HTMLTableElement)) return;
      const header = findResultHeader(table);
      if (!header) return;
      const rows = table.tBodies.length ? [...table.tBodies].flatMap((body) => [...body.rows]) : [...table.rows];
      for (const row of rows) {
        if (row === header.row) continue;
        const cell = row.cells[header.nameIndex];
        if (!cell) continue;
        const text = (cell.textContent ?? '').replace(/\s+/g, ' ').trim();
        const code = text.match(/[0-9][0-9A-Za-z]{7}/)?.[0];
        if (!code) continue;
        const name = text.replace(code, '').replace(/\s+/g, ' ').trim();
        records.push({
          code,
          name: name || undefined,
          faculty: typed.faculty,
          division: typed.rawType,
          commonFlag: typed.kind === 'common',
        });
      }
    });
    return records;
  }

  private fingerprint(): string {
    return [...this.byCode.values()]
      .map((entry) => [entry.code, entry.kind ?? '', entry.faculty ?? '', entry.commonFlag ? '1' : '0', entry.division ?? ''].join(':'))
      .join('\n');
  }

  async load(): Promise<void> {
    this.replace(sanitizeMap(await readStored()));
  }

  async save(): Promise<void> {
    const file: SyllabusMapFile = {
      version: 1,
      source: GUEST_SYLLABUS_ENTRY,
      byCode: Object.fromEntries(this.byCode),
    };
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [SYLLABUS_MAP_KEY]: file });
      return;
    }
    localStore()?.setItem(SYLLABUS_MAP_KEY, JSON.stringify(file));
  }

  watch(onChange: () => void): () => void {
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
        if (area !== 'local' || !changes[SYLLABUS_MAP_KEY]) return;
        this.replace(sanitizeMap(changes[SYLLABUS_MAP_KEY].newValue));
        onChange();
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
    const listener = (event: StorageEvent) => {
      if (event.key !== SYLLABUS_MAP_KEY) return;
      try {
        this.replace(sanitizeMap(event.newValue ? JSON.parse(event.newValue) : null));
      } catch {
        this.replace(sanitizeMap(null));
      }
      onChange();
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }

  /** 検索 POST はしない。ゲスト画面を開き、表示中の結果表を内容スクリプトが保存する。 */
  static async refresh(): Promise<SyllabusRefreshResult> {
    const url = SyllabusLookup.guestEntryUrl();
    if (!url) return { ok: false, reason: 'host-rejected' };
    return { ok: false, reason: 'open-guest-page' };
  }

  static guestEntryUrl(): string | null {
    if (!SyllabusLookup.FIELDS_READY) return null;
    return allowSyllabusFetch(GUEST_SYLLABUS_ENTRY) ? GUEST_SYLLABUS_ENTRY : null;
  }

  private replace(file: SyllabusMapFile): void {
    this.byCode = new Map(Object.entries(file.byCode));
  }
}

function ownText(element: Element): string {
  const parts: string[] = [];
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) parts.push(node.textContent ?? '');
  }
  const direct = parts.join('').replace(/\s+/g, '');
  if (direct) return direct;
  if (element.children.length === 0) return (element.textContent ?? '').replace(/\s+/g, '');
  return '';
}

function controlText(scope: Element): string {
  const menu = scope.querySelector('.ui-selectonemenu-label');
  const menuText = (menu?.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (menuText) return menuText;
  const select = scope instanceof HTMLSelectElement ? scope : scope.querySelector('select');
  if (select instanceof HTMLSelectElement) {
    return (select.selectedOptions[0]?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
  return '';
}

function readFilterValue(root: ParentNode, label: RegExp): string {
  const nodes = root.querySelectorAll('th, td, label, span, div');
  for (const node of nodes) {
    const text = ownText(node);
    if (!text || text.length > 24 || !label.test(text)) continue;
    const cell = node.closest('td, th');
    const next = cell?.nextElementSibling;
    if (next) {
      const value = controlText(next);
      if (value) return value;
    }
    const parent = node.parentElement;
    const sibling = parent?.querySelector('select, .ui-selectonemenu-label');
    if (sibling && sibling !== node) {
      const value = controlText(sibling.parentElement ?? sibling);
      if (value) return value;
    }
  }
  return '';
}

function findResultHeader(table: HTMLTableElement): { row: HTMLTableRowElement; nameIndex: number } | null {
  const candidates = table.tHead ? [...table.tHead.rows] : [...table.rows].slice(0, 2);
  for (const row of candidates) {
    const labels = [...row.cells].map((cell) => (cell.textContent ?? '').replace(/\s+/g, ''));
    const nameIndex = labels.findIndex((label) => label.includes('授業科目') || label === '科目名');
    const hasTeacher = labels.some((label) => label.includes('担当'));
    if (nameIndex >= 0 && hasTeacher) return { row, nameIndex };
  }
  return null;
}

export function isGuestSyllabusPath(pathname: string): boolean {
  return pathname.includes('/uprx/up/pk/pky001/Pky00101');
}

async function readStored(): Promise<unknown> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const data = await chrome.storage.local.get(SYLLABUS_MAP_KEY);
    return data[SYLLABUS_MAP_KEY];
  }
  const raw = localStore()?.getItem(SYLLABUS_MAP_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
