import { describe, expect, it, vi } from 'vitest';
import { applyColoring } from '../src/content/apply';
import { createCourseCache } from '../src/content/cache';
import { FIXTURE_HTML } from '../src/content/fixture';
import {
  allowSyllabusFetch,
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
    expect(SyllabusLookup.FIELDS_READY).toBe(false);
    expect(SyllabusLookup.guestEntryUrl()).toBeNull();
  });

  it('項目が届くまで取得しない', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(SyllabusLookup.refresh()).resolves.toEqual({ ok: false, reason: 'guest-fields-pending' });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
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