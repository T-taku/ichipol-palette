import type { CourseRecord } from '../shared/types';

/**
 * ログイン済み履修登録の実測前の仮セレクタ。
 *
 * Unipaヘルパーが `/uprx/up/.../*.xhtml` を見たあと、このファイルだけを実測に合わせる。
 * 差し替え対象は次の3つ。
 * - 開講学部・学科 … `HEADER_FIELDS` の department / faculty、`LABEL_FIELDS`、`LIVE_ATTRIBUTE_HOOKS`
 * - 科目区分 … `HEADER_FIELDS` の division、`LABEL_FIELDS`、`LIVE_ATTRIBUTE_HOOKS.division`
 * - 共通科目 … `COMMON_TEXT_PATTERNS`、`JSON_FIELD_KEYS` の commonFlag、`LIVE_ATTRIBUTE_HOOKS.commonFlag`
 *
 * `LIVE_TABLE_SELECTORS` と `LIVE_ATTRIBUTE_HOOKS` は空が初期値。
 * 空のあいだは表見出しの文言で判定する。実測の CSS セレクタや data 属性が分かったら配列へ足す。
 *
 * 認証の入口は `https://ichipol.g.hiroshima-cu.ac.jp/uprx/ShibbolethAuthServlet`。
 * セッションのない画面への直リンクは開かない。この拡張はログインしない。
 */

export type HeaderField = 'code' | 'name' | 'instructor' | 'department' | 'faculty' | 'division';

export const HEADER_FIELDS: { field: HeaderField; patterns: RegExp[] }[] = [
  { field: 'code', patterns: [/授業コード/, /科目コード/, /講義コード/, /授業番号/, /^コード$/] },
  { field: 'name', patterns: [/授業科目名/, /授業科目/, /科目名/, /講義題目/, /講義名/, /^科目$/] },
  { field: 'instructor', patterns: [/担当教員/, /教員名/, /担当者/, /^教員$/, /^担当$/] },
  // 開講学部・学科。実測の見出し（例: 「開講学部・学科」）が違えばここを足す。
  { field: 'department', patterns: [/開講学部.?学科/, /開講学科/, /学科組織/, /開講所属/, /開設学科/] },
  { field: 'faculty', patterns: [/^開講学部$/, /^開設学部$/] },
  // 科目区分。実測で別見出しならここを足す。
  { field: 'division', patterns: [/科目区分/, /授業管理部署/, /科目分類/, /授業区分/, /^区分$/] },
];

export const LABEL_FIELDS: { field: HeaderField; pattern: RegExp }[] = [
  { field: 'code', pattern: /^(授業コード|科目コード|講義コード)$/ },
  { field: 'name', pattern: /^(授業科目|授業科目名|科目名|講義題目)$/ },
  { field: 'instructor', pattern: /^(担当教員|教員名|担当者)$/ },
  { field: 'department', pattern: /^(開講学科|学科組織|開講所属|開講学部.?学科)$/ },
  { field: 'faculty', pattern: /^(開講学部|開設学部)$/ },
  { field: 'division', pattern: /^(科目区分|授業管理部署|科目分類)$/ },
];

export const CONTEXT_FIELDS: { field: 'department' | 'faculty' | 'division'; pattern: RegExp }[] = [
  { field: 'division', pattern: /授業管理部署|科目区分|科目分類/ },
  { field: 'department', pattern: /学科組織|開講学科|開講学部.?学科|開講所属/ },
  { field: 'faculty', pattern: /開講学部|開設学部/ },
];

/** 共通科目とみなす文言。実測の科目区分ラベルが分かったら追加する。「学部共通」は含めない。 */
export const COMMON_TEXT_PATTERNS: readonly RegExp[] = [
  /全学共通/,
  /総合共通/,
  /共通教育/,
  /教養教育/,
  /教養科目/,
  /一般情報処理/,
  /保健体育/,
  /外国語系/,
  /初年次演習/,
  /キャリア形成/,
  /広島・?地域志向/,
  /地域志向科目/,
  /平和科目/,
  /共通科目[ABCＡＢＣ]/,
  /(?<!学部)共通科目/,
  /全学教育/,
  /全学展開/,
];

/**
 * 同一オリジン JSON のキー（小文字・記号なし）→ 項目。
 * 実測のレスポンスキーが分かったらここへ足す。
 */
export const JSON_FIELD_KEYS: Record<string, HeaderField | 'commonFlag'> = {
  jugyocd: 'code',
  jugyocode: 'code',
  jyugyocd: 'code',
  kmkcd: 'code',
  kamokucd: 'code',
  kamokcd: 'code',
  coursecode: 'code',
  classcode: 'code',
  jugyoname: 'name',
  jugyonm: 'name',
  kmkname: 'name',
  kamokuname: 'name',
  kamokunm: 'name',
  coursename: 'name',
  tanninname: 'instructor',
  kynname: 'instructor',
  instructorname: 'instructor',
  gakkaname: 'department',
  gakkanm: 'department',
  sgksname: 'department',
  sgksnm: 'department',
  kaikoingakka: 'department',
  gakubuname: 'faculty',
  gakubunm: 'faculty',
  kbnname: 'division',
  kamokukbn: 'division',
  kamokukbnr: 'division',
  kmkbnrname: 'division',
  jugyokanribusho: 'division',
  kyotsuflg: 'commonFlag',
  kyotsuflag: 'commonFlag',
  commonflg: 'commonFlag',
};

/** 空なら `table` 全体を見出しで見る。実測後に履修一覧のセレクタだけを入れる。 */
export const LIVE_TABLE_SELECTORS: { courseTable: readonly string[] } = {
  courseTable: [],
};

/**
 * 行やセルの属性名。空のあいだは読まない。
 * 例: department: ['data-kaiko-gakka']、commonFlag: ['data-kyotsu']
 */
export const LIVE_ATTRIBUTE_HOOKS: {
  department: readonly string[];
  faculty: readonly string[];
  division: readonly string[];
  commonFlag: readonly string[];
} = {
  department: [],
  faculty: [],
  division: [],
  commonFlag: [],
};

export type AttributeHooks = typeof LIVE_ATTRIBUTE_HOOKS;

function attributeValue(element: Element, name: string): string {
  const own = element.getAttribute(name);
  if (own?.trim()) return own.trim();
  for (const node of element.querySelectorAll('*')) {
    const value = node.getAttribute(name);
    if (value?.trim()) return value.trim();
  }
  return '';
}

/** 実測で埋めた属性フックを読む。未設定のフックは何もしない。 */
export function readAttributeHooks(element: Element, hooks: AttributeHooks = LIVE_ATTRIBUTE_HOOKS): Partial<CourseRecord> {
  const record: Partial<CourseRecord> = {};
  const department = hooks.department.map((name) => attributeValue(element, name)).find(Boolean);
  const faculty = hooks.faculty.map((name) => attributeValue(element, name)).find(Boolean);
  const division = hooks.division.map((name) => attributeValue(element, name)).find(Boolean);
  const flag = hooks.commonFlag.map((name) => attributeValue(element, name)).find(Boolean);
  if (department) record.department = department;
  if (faculty) record.faculty = faculty;
  if (division) record.division = division;
  if (flag && /^(1|true|yes|共通|共通科目)$/i.test(flag)) record.commonFlag = true;
  return record;
}
