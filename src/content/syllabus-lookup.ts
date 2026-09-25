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

export interface SyllabusEntry {
  code: string;
  name?: string;
  department?: string;
  faculty?: string;
  division?: string;
  commonFlag?: boolean;
}

export interface SyllabusMapFile {
  version: 1;
  source: string;
  byCode: Record<string, SyllabusEntry>;
}

export type SyllabusRefreshResult =
  | { ok: true; added: number }
  | { ok: false; reason: 'guest-fields-pending' | 'host-rejected' };

/**
 * ゲスト検索画面の列は未着。
 * TODO(Unipaヘルパー): 授業コード、開講学部・学科、科目区分、共通の位置が届いたら
 * `ingestGuestDocument` を実装し、このフラグを true にする。それまで fetch しない。
 */
export const GUEST_FIELDS_READY = false;

function codeKey(code: string): string {
  return normalize(code);
}

function asEntry(record: CourseRecord): SyllabusEntry | null {
  const code = record.code?.trim() ?? '';
  if (!/^\d{6,10}$/.test(codeKey(code))) return null;
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
  if (record.commonFlag) entry.commonFlag = true;
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

  /** セル側に既にある学科・区分は残し、空きだけ索引で埋める。 */
  complete(record: CourseRecord): CourseRecord {
    const key = record.code ? codeKey(record.code) : '';
    if (!key) return record;
    const hit = this.byCode.get(key);
    if (!hit) return record;
    return mergeRecords(record, hit);
  }

  /**
   * TODO(Unipaヘルパー): ゲストシラバスの検索結果 DOM から授業コードごとの所属を読む。
   * 列が届くまで空。推測のセレクタでは読まない。
   */
  ingestGuestDocument(_root: ParentNode): CourseRecord[] {
    return [];
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

  /** 項目未着のあいだはネットワークを開かない。 */
  static async refresh(): Promise<SyllabusRefreshResult> {
    if (!SyllabusLookup.FIELDS_READY) return { ok: false, reason: 'guest-fields-pending' };
    const url = SyllabusLookup.guestEntryUrl();
    if (!url) return { ok: false, reason: 'host-rejected' };
    // TODO(Unipaヘルパー): 検索条件が分かってから url だけを取得し、ingestGuestDocument する。
    return { ok: false, reason: 'guest-fields-pending' };
  }

  static guestEntryUrl(): string | null {
    if (!SyllabusLookup.FIELDS_READY) return null;
    return allowSyllabusFetch(GUEST_SYLLABUS_ENTRY) ? GUEST_SYLLABUS_ENTRY : null;
  }

  private replace(file: SyllabusMapFile): void {
    this.byCode = new Map(Object.entries(file.byCode));
  }
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
