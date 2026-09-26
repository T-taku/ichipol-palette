import { describe, expect, it } from 'vitest';
import { classify, isCommonCourse, reasonLabel, ruleMatches } from '../src/shared/classify';
import { inferFaculty } from '../src/shared/classify-faculty';
import { sanitizeSettings } from '../src/shared/defaults';
import type { Settings } from '../src/shared/types';

function settings(partial: Partial<Settings> = {}): Settings {
  return sanitizeSettings({
    faculty: '情報科学部',
    department: '情報工学科',
    ...partial,
  });
}

describe('classify', () => {
  it('全学共通・教養・外国語系は共通科目', () => {
    const user = settings();
    expect(classify({ name: '平和と広島', division: '全学共通系科目' }, user).category).toBe('common');
    expect(classify({ name: '英語コミュニケーション', division: '外国語系科目' }, user).category).toBe('common');
    expect(classify({ division: '共通科目A' }, user).category).toBe('common');
    expect(classify({ name: 'キャリア形成入門', division: 'キャリア形成・実践科目' }, user).category).toBe('common');
    expect(isCommonCourse({ division: '教養科目' })).toBe(true);
  });

  it('学部共通は全学の共通科目にしない', () => {
    const result = classify(
      { name: '情報科学実験', department: '情報科学部', division: '学部共通科目' },
      settings(),
    );
    expect(result.category).toBe('own');
    expect(result.reason).toBe('faculty-wide');
  });

  it('開講学科が一致すれば自学科、別学科は他学科', () => {
    const user = settings();
    expect(classify({ name: 'プログラミング言語論', department: '情報科学部情報工学科' }, user).category).toBe('own');
    expect(classify({ name: '知識情報処理', department: '情報科学部 知能工学科' }, user).category).toBe('other');
    expect(classify({ department: '国際学部 国際学科' }, user).category).toBe('other');
  });

  it('美術学科の専攻が違えば他学科、専攻の無い学科開講は自学科', () => {
    const user = settings({ faculty: '芸術学部', department: '美術学科 日本画専攻' });
    expect(classify({ department: '芸術学部 美術学科 油絵専攻' }, user).category).toBe('other');
    expect(classify({ department: '美術学科' }, user).category).toBe('own');
  });

  it('学科未設定のときは共通以外を塗らない', () => {
    const user = settings({ faculty: '', department: '' });
    expect(classify({ division: '全学共通系科目' }, user).category).toBe('common');
    expect(classify({ department: '情報工学科' }, user).category).toBe('unknown');
    expect(classify({ name: '特別講義' }, user).reason).toBe('user-unset');
  });

  it('所属が取れなければ未判定', () => {
    expect(classify({ name: '特別講義' }, settings()).reason).toBe('no-metadata');
  });

  it('上書きルールが自動判定より先', () => {
    const user = settings({
      rules: [
        { id: 'eng', enabled: true, field: 'name', match: 'includes', pattern: '英語', category: 'common' },
        { id: 'bad', enabled: true, field: 'name', match: 'regex', pattern: '(', category: 'other' },
      ],
    });
    expect(classify({ name: '英語コミュニケーション', department: '情報工学科' }, user).category).toBe('common');
    expect(ruleMatches(user.rules[1], { name: '英語' })).toBe(false);
    expect(classify({ name: 'プログラミング言語論', department: '知能工学科' }, user).category).toBe('other');
  });

  it('情報科学部の学部配属は、学科名の無い専門科目だけを自学科にする', () => {
    const user = settings({ department: '学部配属' });
    expect(inferFaculty('学部配属')).toBe('情報科学部');
    expect(
      classify(
        { name: '批判的創造的思考法', catalogCategory: 'faculty', catalogFaculty: '情報科学部', faculty: '情報科学部' },
        user,
      ).category,
    ).toBe('own');
    expect(
      classify(
        {
          name: '情報システム開発（情報工学科）',
          department: '情報工学科',
          catalogCategory: 'faculty',
          catalogFaculty: '情報科学部',
          faculty: '情報科学部',
        },
        user,
      ).category,
    ).toBe('other');
    expect(
      classify(
        { name: '基礎演習', catalogCategory: 'faculty', catalogFaculty: '国際学部', faculty: '国際学部' },
        user,
      ).category,
    ).toBe('other');
    expect(classify({ name: '情報社会論', catalogCategory: 'common', commonFlag: true }, user).category).toBe('common');
  });

  it('索引の学科が違えば同じ学部でも他学科、学科の無い学部開講は自学科', () => {
    const info = settings();
    const intelligence = settings({ department: '知能工学科' });
    const medical = settings({ department: '医用情報科学科' });
    const traffic = {
      name: 'トラフィック分析',
      department: '情報工学科',
      catalogCategory: 'faculty' as const,
      catalogFaculty: '情報科学部',
    };
    const shared = {
      name: 'オペレーティングシステム',
      department: '情報工学科 医用情報科学科',
      catalogCategory: 'faculty' as const,
      catalogFaculty: '情報科学部',
    };
    const foundation = {
      name: 'プログラミングⅡ',
      catalogCategory: 'faculty' as const,
      catalogFaculty: '情報科学部',
      faculty: '情報科学部',
    };
    expect(classify(traffic, info)).toMatchObject({ category: 'own', reason: 'department' });
    expect(classify(traffic, intelligence).category).toBe('other');
    expect(classify(shared, info).category).toBe('own');
    expect(classify(shared, medical).category).toBe('own');
    expect(classify(shared, intelligence).category).toBe('other');
    expect(classify(foundation, intelligence)).toMatchObject({ category: 'own', reason: 'faculty-wide' });
    expect(classify(foundation, settings({ department: '学部配属' })).category).toBe('own');
    expect(classify(shared, settings({ department: '学部配属' })).category).toBe('other');
    expect(
      classify(traffic, settings({ faculty: '芸術学部', department: '美術学科 油絵専攻' })).category,
    ).toBe('other');
    expect(
      classify(
        {
          name: '日本画実習Ⅳ',
          department: '美術学科 日本画専攻',
          catalogCategory: 'faculty',
          catalogFaculty: '芸術学部',
        },
        settings({ faculty: '芸術学部', department: '美術学科 日本画専攻' }),
      ).category,
    ).toBe('own');
    expect(
      classify(
        {
          name: '日本画実習Ⅳ',
          department: '美術学科 日本画専攻',
          catalogCategory: 'faculty',
          catalogFaculty: '芸術学部',
        },
        settings({ faculty: '芸術学部', department: '美術学科 油絵専攻' }),
      ).category,
    ).toBe('other');
  });

  it('学部開講を自学科にしない設定では他学科', () => {
    const result = classify(
      { department: '情報科学部', division: '学部共通科目' },
      settings({ treatFacultyWideAsOwn: false }),
    );
    expect(result.category).toBe('other');
  });

  it('他学科の理由には開講している学科か学部を出す', () => {
    const traffic = {
      name: 'トラフィック分析',
      department: '情報工学科',
      faculty: '情報科学部',
      catalogCategory: 'faculty' as const,
      catalogFaculty: '情報科学部',
    };
    const international = {
      name: '基礎演習',
      department: '国際学科',
      faculty: '国際学部',
      catalogCategory: 'faculty' as const,
      catalogFaculty: '国際学部',
    };
    const facultyOnly = {
      name: '基礎演習',
      faculty: '国際学部',
      catalogCategory: 'faculty' as const,
      catalogFaculty: '国際学部',
    };
    const nihonga = {
      name: '日本画実習Ⅳ',
      department: '美術学科 日本画専攻',
      faculty: '芸術学部',
      catalogCategory: 'faculty' as const,
      catalogFaculty: '芸術学部',
    };
    const shared = {
      name: 'オペレーティングシステム',
      department: '情報工学科 医用情報科学科',
      faculty: '情報科学部',
      catalogCategory: 'faculty' as const,
      catalogFaculty: '情報科学部',
    };
    const intelligence = settings({ department: '知能工学科' });
    expect(reasonLabel(classify(traffic, intelligence), intelligence, traffic)).toBe('「情報科学部 情報工学科」の講義');
    expect(reasonLabel(classify(international, settings()), settings(), international)).toBe('「国際学部 国際学科」の講義');
    expect(reasonLabel(classify(facultyOnly, settings()), settings(), facultyOnly)).toBe('「国際学部」の講義');
    expect(
      reasonLabel(classify(nihonga, settings({ faculty: '芸術学部', department: '美術学科 油絵専攻' })), settings({ faculty: '芸術学部', department: '美術学科 油絵専攻' }), nihonga),
    ).toBe('「芸術学部 美術学科 日本画専攻」の講義');
    expect(reasonLabel(classify(shared, intelligence), intelligence, shared)).toBe('「情報科学部 情報工学科・医用情報科学科」の講義');
    expect(reasonLabel(classify({ name: 'データベース', department: '知能工学科' }, settings()), settings(), { name: 'データベース', department: '知能工学科' })).toBe(
      '「知能工学科」の講義',
    );
  });
});
