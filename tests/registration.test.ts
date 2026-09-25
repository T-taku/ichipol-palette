import { describe, expect, it } from 'vitest';
import { applyColoring } from '../src/content/apply';
import { createCourseCache } from '../src/content/cache';
import { FIXTURE_HTML } from '../src/content/fixture';
import { departmentFromParens, parseCourseCell, pickDepartment, readSyllabusDialog } from '../src/content/registration';
import { LIVE_PAGE } from '../src/content/selectors';
import { sanitizeSettings } from '../src/shared/defaults';

const info = sanitizeSettings({ faculty: '情報科学部', department: '情報工学科' });

function cellCategory(root: ParentNode, code: string): string | null {
  const cell = [...root.querySelectorAll('td')].find((item) => item.textContent?.includes(code) && item.closest('#rishu, table'));
  const timetable = [...root.querySelectorAll('#rishu td')].find((item) => item.textContent?.includes(code));
  return (timetable ?? cell)?.getAttribute('data-hcu-cat') ?? null;
}

describe('履修登録の時間割', () => {
  it('セレクタは j_idt を使わない', () => {
    expect(LIVE_PAGE.registrationPath).toBe('/uprx/up/bs/bsa001/');
    expect(LIVE_PAGE.syllabusDialog).toBe('[role="dialog"][aria-label="シラバス照会"]');
    expect(JSON.stringify(LIVE_PAGE)).not.toContain('j_idt');
    expect(LIVE_PAGE.tabLabels).toEqual(['授業を選択', '授業を追加']);
  });

  it('括弧が学科のときだけ開講学科にする', () => {
    expect(departmentFromParens('情報システム開発（情報工学科）')).toBe('情報工学科');
    expect(departmentFromParens('情報システム開発（イノベクラス）')).toBeUndefined();
    expect(departmentFromParens('情報セキュリティ基礎（A,B,Cクラス）')).toBeUndefined();
    expect(departmentFromParens('英語応用演習IV (Advanced 2)')).toBeUndefined();
    expect(pickDepartment('情報工学科学生のみ対象')).toBe('情報工学科');
    expect(pickDepartment('2年')).toBeUndefined();
    expect(pickDepartment('情報工学科と知能工学科')).toBeUndefined();
    expect(pickDepartment('他学科')).toBeUndefined();
  });

  it('見本の履修登録セルを授業コードで塗る', () => {
    document.body.innerHTML = FIXTURE_HTML;
    applyColoring(document.body, info, createCourseCache());
    expect(cellCategory(document.body, '26432203')).toBe('own');
    expect(cellCategory(document.body, '26432202')).toBe('own');
    expect(cellCategory(document.body, '20414301')).toBeNull();
    expect(cellCategory(document.body, '00110401')).toBeNull();
    expect(document.querySelector('#rishu td:nth-child(3)')?.getAttribute('data-hcu-cat')).toBeNull();
    const dialogCode = [...document.querySelectorAll('[aria-label="シラバス照会"] td')].find((cell) => cell.textContent?.includes('26432202'));
    expect(dialogCode?.getAttribute('data-hcu-cat')).toBeNull();
    expect(document.querySelector('#units [data-hcu-cat]')).toBeNull();
    const intensive = [...document.querySelectorAll('#intensive tr')].find((row) => row.textContent?.includes('データベース'));
    expect(intensive?.getAttribute('data-hcu-cat')).toBe('other');
    const dialog = readSyllabusDialog(document.body);
    expect(dialog).toMatchObject({ code: '26432202', department: '情報工学科' });
  });

  it('シラバスが閉じているイノベクラスは未判定', () => {
    document.body.innerHTML = `
      <div role="group" aria-label="2026年度 後期">
        <table>
          <tr><th>月曜日</th><th>火曜日</th><th>水曜日</th><th>木曜日</th><th>金曜日</th></tr>
          <tr>
            <td>情報システム開発（イノベクラス）<br>大田 知行<br>26432202<br>2.0単位</td>
            <td></td><td></td><td></td><td></td>
          </tr>
        </table>
      </div>`;
    applyColoring(document.body, info, createCourseCache());
    const cell = document.querySelector('td');
    expect(parseCourseCell(cell as HTMLTableCellElement)?.name).toBe('情報システム開発（イノベクラス）');
    expect(cell?.getAttribute('data-hcu-cat')).toBeNull();
  });

  it('セル内の全学共通は共通科目にする', () => {
    document.body.innerHTML = `
      <table>
        <tr><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th></tr>
        <tr><td>全学共通セミナー<br>00119901<br>2.0単位</td><td></td><td></td><td></td><td></td></tr>
      </table>`;
    applyColoring(document.body, info, createCourseCache());
    expect(document.querySelector('tbody td, tr:nth-child(2) td')?.getAttribute('data-hcu-cat')).toBe('common');
  });
});
