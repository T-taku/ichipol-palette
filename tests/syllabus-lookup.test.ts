import { describe, expect, it, vi } from 'vitest';
import { applyColoring } from '../src/content/apply';
import { createCourseCache } from '../src/content/cache';
import { FIXTURE_HTML } from '../src/content/fixture';
import {
  allowSyllabusFetch,
  classifySubjectType,
  GUEST_SYLLABUS_ENTRY,
  SyllabusLookup,
  SYLLABUS_MAP_KEY,
} from '../src/content/syllabus-lookup';
import { sanitizeSettings } from '../src/shared/defaults';

const info = sanitizeSettings({ faculty: '情報科学部', department: '情報工学科' });

function timetableCategory(code: string): string | null {
  return (
    [...document.querySelectorAll('#rishu td')].find((cell) => cell.textContent?.includes(code))?.getAttribute('data-hcu-cat') ??
    null
  );
}

describe('ゲストシラバス索引', () => {
  it('取得先はいちぽる自身だけ', () => {
    expect(allowSyllabusFetch(GUEST_SYLLABUS_ENTRY)).toBe(true);
    expect(allowSyllabusFetch('https://example.com/uprx/up/pk/pky001/Pky00101.xhtml')).toBe(false);
    expect(allowSyllabusFetch('https://www.hiroshima-cu.ac.jp/uprx/')).toBe(false);
    expect(SyllabusLookup.FIELDS_READY).toBe(true);
    expect(SyllabusLookup.guestEntryUrl()).toBe(GUEST_SYLLABUS_ENTRY);
    expect(classifySubjectType('全学共通科目')).toEqual({ kind: 'common', rawType: '全学共通科目' });
    expect(classifySubjectType('情報科学部専門科目')?.faculty).toBe('情報科学部');
    expect(classifySubjectType('国際学部専門科目')?.faculty).toBe('国際学部');
    expect(classifySubjectType('講義')).toBeNull();
    expect(classifySubjectType('すべて対象')).toBeNull();
    expect(classifySubjectType('単位互換科目')).toBeNull();
  });

  it('検索 POST はせず、開いた結果表だけを読む', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(SyllabusLookup.refresh()).resolves.toEqual({ ok: false, reason: 'open-guest-page' });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('科目授業種別を、見えている授業コードに付ける', () => {
    document.body.innerHTML = `
      <table><tr><th>科目授業種別</th><td><select><option selected>全学共通科目</option></select></td></tr></table>
      <table>
        <tr><th>曜日時限</th><th>授業科目</th><th>担当教員</th><th>開講区分</th><th>開講年度学期</th><th>単位数</th></tr>
        <tr><td>月3</td><td>00110401 情報社会論</td><td>八城 年伸</td><td>週間授業</td><td>2026年度 後期</td><td>2.0単位</td></tr>
      </table>
      <div role="dialog" aria-label="シラバス照会"><table><tr><th>授業コード</th><td>00110401</td></tr><tr><th>科目名</th><td>情報社会論</td></tr><tr><th>履修対象</th><td>1年</td></tr></table></div>`;
    const syllabus = new SyllabusLookup();
    const records = syllabus.ingestGuestDocument(document.body);
    expect(records).toEqual([{ code: '00110401', name: '情報社会論', faculty: undefined, division: '全学共通科目', commonFlag: true }]);
    syllabus.absorb(records);
    document.body.innerHTML += `
      <div role="group" aria-label="2026年度 後期"><table>
        <tr><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th></tr>
        <tr><td>情報社会論<br>00110401<br>2.0単位</td><td></td><td></td><td></td><td></td></tr>
      </table></div>`;
    applyColoring(document.body, info, createCourseCache(), syllabus);
    expect(document.querySelector('td')?.textContent).toBeTruthy();
    const cell = [...document.querySelectorAll('td')].find((item) => item.textContent?.includes('00110401') && item.closest('[aria-label="2026年度 後期"]'));
    expect(cell?.getAttribute('data-hcu-cat')).toBe('common');
  });

  it('他学部の専門科目は他学科、同じ学部の専門科目は自学科の色', () => {
    document.body.innerHTML = `
      <table><tr><th>科目授業種別</th><td><select><option selected>国際学部専門科目</option></select></td></tr></table>
      <table>
        <tr><th>曜日時限</th><th>授業科目</th><th>担当教員</th></tr>
        <tr><td>木3</td><td>103K0401 基礎演習</td><td>田浪 亜央江</td></tr>
      </table>
      <table id="week">
        <tr><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th></tr>
        <tr><td></td><td></td><td></td><td>基礎演習<br>103K0401<br>1.0単位</td><td>専門実験<br>26439901<br>2.0単位</td></tr>
      </table>`;
    const syllabus = new SyllabusLookup();
    syllabus.absorb(syllabus.ingestGuestDocument(document.body));
    syllabus.remember([{ code: '26439901', faculty: '情報科学部', division: '情報科学部専門科目', commonFlag: false }]);
    applyColoring(document.body, info, createCourseCache(), syllabus);
    const cat = (code: string) =>
      [...document.querySelectorAll('#week td')].find((cell) => cell.textContent?.includes(code))?.getAttribute('data-hcu-cat');
    expect(cat('103K0401')).toBe('other');
    expect(cat('26439901')).toBe('own');
  });

  it('授業コードで空欄の所属を埋める', () => {
    document.body.innerHTML = FIXTURE_HTML;
    const syllabus = new SyllabusLookup();
    syllabus.remember([
      { code: '20414301', name: '批判的創造的思考法', division: '全学共通' },
      { code: '00110401', department: '情報工学科' },
      { code: '26432203', department: '知能工学科' },
    ]);
    expect(syllabus.ingestGuestDocument(document.body)).toEqual([]);
    applyColoring(document.body, info, createCourseCache(), syllabus);
    expect(timetableCategory('20414301')).toBe('common');
    expect(timetableCategory('00110401')).toBe('own');
    expect(timetableCategory('26432203')).toBe('own');
  });

  it('索引は chrome.storage の代わりにローカルへ残る', async () => {
    localStorage.removeItem(SYLLABUS_MAP_KEY);
    const syllabus = new SyllabusLookup();
    syllabus.remember([{ code: '20414301', division: '全学共通', commonFlag: true }]);
    await syllabus.save();
    const loaded = new SyllabusLookup();
    await loaded.load();
    expect(loaded.complete({ code: '20414301', name: '批判的創造的思考法' })).toMatchObject({
      division: '全学共通',
      commonFlag: true,
      name: '批判的創造的思考法',
    });
    localStorage.removeItem(SYLLABUS_MAP_KEY);
  });
});