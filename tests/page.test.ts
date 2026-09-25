import { describe, expect, it } from 'vitest';
import { applyColoring } from '../src/content/apply';
import { createCourseCache } from '../src/content/cache';
import { findCourseRows, readPageContext } from '../src/content/extract-dom';
import { FIXTURE_HTML } from '../src/content/fixture';
import { extractRecordsFromPayload } from '../src/content/parse-payload';
import { safeSyllabusUrl } from '../src/content/urls';
import { sanitizeSettings } from '../src/shared/defaults';

const base = 'https://ichipol.g.hiroshima-cu.ac.jp/uprx/up/km/kmd004/Kmd00401.xhtml';

describe('画面の読み取り', () => {
  it('シラバス表の行を見出しから科目にする', () => {
    document.body.innerHTML = FIXTURE_HTML;
    const rows = findCourseRows(document.body);
    const names = rows.map((row) => row.record.name);
    expect(names).toContain('プログラミング言語論');
    expect(names).toContain('キャリア形成入門');
    expect(names).not.toContain('月');
    const own = rows.find((row) => row.record.code === '1101');
    expect(own?.record.department).toContain('情報工学科');
    expect(own?.inheritContext).toBe(false);
    const picker = rows.find((row) => row.record.name === 'アルゴリズム特論');
    expect(picker?.inheritContext).toBe(true);
  });

  it('プレースホルダの検索条件は科目に混ぜない', () => {
    document.body.innerHTML = FIXTURE_HTML;
    expect(readPageContext(document.getElementById('syllabus-form')!)).toEqual({});
  });

  it('学科列が無い表は、同じフォームの学科組織を補う', () => {
    document.body.innerHTML = `
      <form>
        <label for="org">学科組織</label>
        <select id="org"><option selected>情報科学部 情報工学科</option></select>
        <table>
          <thead><tr><th>授業科目</th><th>担当教員</th><th>単位</th></tr></thead>
          <tbody><tr><td>オペレーティングシステム</td><td>広島 太郎</td><td>2</td></tr></tbody>
        </table>
      </form>`;
    const [row] = findCourseRows(document.body);
    const context = readPageContext(row.row.closest('form')!);
    expect(context.department).toBe('情報科学部 情報工学科');
    const stats = applyColoring(
      document.body,
      sanitizeSettings({ faculty: '情報科学部', department: '情報工学科' }),
      createCourseCache(),
    );
    expect(row.row.dataset.hcuCat).toBe('own');
    expect(stats.own).toBe(1);
  });

  it('見本を自学科・他学科・共通に塗る', () => {
    document.body.innerHTML = FIXTURE_HTML;
    const stats = applyColoring(
      document.body,
      sanitizeSettings({ faculty: '情報科学部', department: '情報工学科' }),
      createCourseCache(),
    );
    const category = (name: string) =>
      [...document.querySelectorAll('tr')].find((row) => row.textContent?.includes(name))?.getAttribute('data-hcu-cat');
    expect(category('プログラミング言語論')).toBe('own');
    expect(category('知識情報処理')).toBe('other');
    expect(category('平和と広島')).toBe('common');
    expect(category('英語コミュニケーション')).toBe('common');
    expect(category('情報科学実験')).toBe('own');
    expect(category('国際関係論')).toBe('other');
    expect(category('油絵基礎実習')).toBe('other');
    expect(category('特別講義')).toBeNull();
    expect(category('キャリア形成入門')).toBe('common');
    expect(category('アルゴリズム特論')).toBeNull();
    const monday = document.querySelector('#week tbody td:nth-child(2)');
    const wednesday = document.querySelector('#week tbody td:nth-child(4)');
    expect(monday?.getAttribute('data-hcu-cat')).toBe('own');
    expect(wednesday?.getAttribute('data-hcu-cat')).toBe('common');
    expect(stats.own).toBeGreaterThan(0);
    expect(document.querySelector('.hcu-rc-badge')?.textContent).toBeTruthy();
  });
});

describe('応答の解析', () => {
  it('JSON の科目フィールドを拾う', () => {
    const records = extractRecordsFromPayload(
      JSON.stringify({
        jugyoList: [{ jugyoCd: '2002', jugyoName: '知識情報処理', gakkaName: '情報科学部知能工学科', kyotsuFlg: 0 }],
      }),
    );
    expect(records[0]).toMatchObject({ code: '2002', name: '知識情報処理', department: '情報科学部知能工学科' });
  });

  it('PrimeFaces の partial-response から表を拾う', () => {
    const html = `<table><tr><th>授業コード</th><th>授業科目</th><th>開講学科</th></tr><tr><td>3003</td><td>システム設計</td><td>システム工学科</td></tr></table>`;
    const payload = `<?xml version="1.0"?><partial-response><changes><update id="form:table"><![CDATA[${html}]]></update></changes></partial-response>`;
    const records = extractRecordsFromPayload(payload);
    expect(records.some((record) => record.name === 'システム設計' && record.department === 'システム工学科')).toBe(true);
  });

  it('シラバス詳細の項目名から学科を拾う', () => {
    const html = `<table><tr><th>授業科目</th><td>地域志向入門</td></tr><tr><th>科目区分</th><td>全学共通系科目</td></tr></table>`;
    const [record] = extractRecordsFromPayload(html);
    expect(record).toMatchObject({ name: '地域志向入門', division: '全学共通系科目' });
  });
});

describe('同一オリジンのリンク', () => {
  it('いちぽるの xhtml だけを許可する', () => {
    expect(safeSyllabusUrl('/uprx/up/km/kmh005/Kmh00502.xhtml?jugyoCd=1101', base)).toBe(
      'https://ichipol.g.hiroshima-cu.ac.jp/uprx/up/km/kmh005/Kmh00502.xhtml?jugyoCd=1101',
    );
    expect(safeSyllabusUrl('javascript:void(0)', base)).toBeNull();
    expect(safeSyllabusUrl('https://example.com/uprx/a.xhtml?x=1', base)).toBeNull();
    expect(safeSyllabusUrl('/uprx/up/km/kmh005/Kmh00502.xhtml', base)).toBeNull();
  });
});
