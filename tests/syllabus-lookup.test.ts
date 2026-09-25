import { describe, expect, it } from 'vitest';
import { applyColoring } from '../src/content/apply';
import { createCourseCache } from '../src/content/cache';
import { applyCatalog, bundledCatalog, lookupCourse } from '../src/content/syllabus-lookup';
import { sanitizeSettings } from '../src/shared/defaults';
import type { CourseCatalog } from '../src/content/syllabus-lookup';

const info = sanitizeSettings({ faculty: '情報科学部', department: '情報工学科' });

const sample: CourseCatalog = {
  year: 2026,
  term: '後期',
  updated: '2026-09-26',
  courses: {
    '00110401': { name: '情報社会論', type: '全学共通科目', category: 'common' },
    '26432203': { name: '情報システム開発（情報工学科）', type: '情報科学部専門科目', category: 'faculty', faculty: '情報科学部' },
    '103K0401': { name: '基礎演習', type: '国際学部専門科目', category: 'faculty', faculty: '国際学部' },
  },
};

function paint(html: string, catalog: CourseCatalog = sample) {
  document.body.innerHTML = html;
  applyColoring(document.body, info, createCourseCache(), catalog);
}

function cat(code: string): string | null {
  return [...document.querySelectorAll('td')].find((cell) => cell.textContent?.includes(code))?.getAttribute('data-hcu-cat') ?? null;
}

describe('同梱の授業コード索引', () => {
  it('プレースホルダは 2026 後期の形', () => {
    expect(bundledCatalog.year).toBe(2026);
    expect(bundledCatalog.term).toBe('後期');
    expect(lookupCourse('00110401')?.category).toBe('common');
    expect(lookupCourse('26432203')?.faculty).toBe('情報科学部');
    expect(lookupCourse('103k0401')?.faculty).toBe('国際学部');
    expect(lookupCourse('20414301')).toBeUndefined();
  });

  it('共通は共通色、同じ学部は自学科、別学部は他学科', () => {
    paint(`
      <table>
        <tr><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th></tr>
        <tr>
          <td>情報社会論<br>00110401<br>2.0単位</td>
          <td>情報システム開発<br>26432203<br>2.0単位</td>
          <td>基礎演習<br>103K0401<br>1.0単位</td>
          <td>批判的創造的思考法<br>20414301<br>2.0単位</td>
          <td></td>
        </tr>
      </table>`);
    expect(cat('00110401')).toBe('common');
    expect(cat('26432203')).toBe('own');
    expect(cat('103K0401')).toBe('other');
    expect(cat('20414301')).toBeNull();
  });

  it('索引にあるコードは、セルの学科名より学部区分を優先する', () => {
    const record = applyCatalog(
      { code: '26432203', name: '情報システム開発（知能工学科）', department: '知能工学科' },
      sample,
    );
    expect(record.catalogCategory).toBe('faculty');
    expect(record.catalogFaculty).toBe('情報科学部');
    expect(record.department).toBeUndefined();
  });

  it('所属が空のときは共通だけ塗る', () => {
    document.body.innerHTML = `
      <table>
        <tr><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th></tr>
        <tr>
          <td>情報社会論<br>00110401</td>
          <td>26432203</td>
          <td></td><td></td><td></td>
        </tr>
      </table>`;
    applyColoring(document.body, sanitizeSettings({}), createCourseCache(), sample);
    expect(cat('00110401')).toBe('common');
    expect(cat('26432203')).toBeNull();
  });
});
