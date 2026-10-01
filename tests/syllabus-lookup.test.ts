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
  it('2026 後期の全件を同梱している', () => {
    expect(bundledCatalog.year).toBe(2026);
    expect(bundledCatalog.term).toBe('後期');
    expect(Object.keys(bundledCatalog.courses)).toHaveLength(978);
    expect(bundledCatalog.counts).toEqual({
      common: 156,
      情報科学部: 128,
      国際学部: 252,
      芸術学部: 93,
      国際学研究科: 205,
      情報科学研究科: 36,
      芸術学研究科: 38,
      平和学研究科: 70,
    });
    expect(lookupCourse('00110401')).toMatchObject({ category: 'common', faculty: null, department: null });
    expect(lookupCourse('26432203')).toMatchObject({ faculty: '情報科学部', department: '情報工学科' });
    expect(lookupCourse('26461401')?.department).toBe('情報工学科');
    expect(lookupCourse('26431501')?.department).toBe('情報工学科 医用情報科学科');
    expect(lookupCourse('20411201')?.department).toBeNull();
    expect(lookupCourse('114A0301')?.department).toBe('国際学科');
    expect(lookupCourse('31323401')?.department).toBe('美術学科 日本画専攻');
    expect(lookupCourse('103k0401')?.faculty).toBe('国際学部');
    expect(lookupCourse('113L1901')?.name).toBe('学部派遣海外インターンシップ');
    expect(lookupCourse('20414301')?.faculty).toBe('情報科学部');
    expect(lookupCourse('28450502')?.department).toBe('システム工学科');
    expect(lookupCourse('001609Z1')).toMatchObject({ category: 'common' });
    expect(lookupCourse('00M10501')).toMatchObject({ category: 'common' });
    expect(lookupCourse('51321601')).toMatchObject({ faculty: '国際学研究科', department: null });
    expect(lookupCourse('66410101')).toMatchObject({ faculty: '情報科学研究科', department: '情報工学専攻 医用情報科学専攻' });
    expect(lookupCourse('99990001')).toBeUndefined();
  });

  it('大学院は研究科と専攻で判定する', () => {
    document.body.innerHTML = `
      <table>
        <tr><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th></tr>
        <tr>
          <td>論理回路・システム特論<br>66410101</td>
          <td>医用ロボット学特論<br>6A411301</td>
          <td>持続可能な開発のための教育（ＥＳＤ）論<br>51321601</td>
          <td>国際関係と平和<br>00M10501</td>
          <td></td>
        </tr>
      </table>`;
    applyColoring(
      document.body,
      sanitizeSettings({ faculty: '情報科学研究科', department: '情報工学専攻' }),
      createCourseCache(),
    );
    expect(cat('66410101')).toBe('own');
    expect(cat('6A411301')).toBe('other');
    expect(cat('51321601')).toBe('other');
    expect(cat('00M10501')).toBe('common');
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

  it('同梱索引では同じ学科と学部開講を自学科にし、別学科と無いコードは塗らない', () => {
    document.body.innerHTML = `
      <table>
        <tr><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th></tr>
        <tr>
          <td>批判的創造的思考法<br>20414301<br>2.0単位</td>
          <td>トラフィック分析<br>26461401<br>2.0単位</td>
          <td>未登録科目<br>99990001<br>2.0単位</td>
          <td>リアルタイムシステム<br>28450502<br>2.0単位</td>
          <td></td>
        </tr>
      </table>`;
    applyColoring(document.body, info, createCourseCache());
    expect(cat('20414301')).toBe('own');
    expect(cat('26461401')).toBe('own');
    expect(cat('99990001')).toBeNull();
    expect(cat('28450502')).toBe('other');
    applyColoring(document.body, sanitizeSettings({ faculty: '情報科学部', department: '知能工学科' }), createCourseCache());
    expect(cat('20414301')).toBe('own');
    expect(cat('26461401')).toBe('other');
  });

  it('索引にあるコードは、セルの学科名より学部区分を優先する', () => {
    const record = applyCatalog(
      { code: '26432203', name: '情報システム開発（知能工学科）', department: '知能工学科' },
      sample,
    );
    expect(record.catalogCategory).toBe('faculty');
    expect(record.catalogFaculty).toBe('情報科学部');
    expect(record.department).toBe('情報工学科');
  });

  it('学部配属は学科名の無い情報科学部の科目だけを自学科にする', () => {
    document.body.innerHTML = `
      <table>
        <tr><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th></tr>
        <tr>
          <td>批判的創造的思考法<br>20414301</td>
          <td>情報システム開発<br>26432203</td>
          <td>基礎演習<br>103K0401</td>
          <td>情報社会論<br>00110401</td>
          <td></td>
        </tr>
      </table>`;
    applyColoring(document.body, sanitizeSettings({ faculty: '情報科学部', department: '学部配属' }), createCourseCache());
    expect(cat('20414301')).toBe('own');
    expect(cat('26432203')).toBe('other');
    expect(cat('103K0401')).toBe('other');
    expect(cat('00110401')).toBe('common');
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
