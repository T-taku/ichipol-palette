export interface FacultyPreset {
  faculty: string;
  departments: string[];
}

/** 情報科学部の1年。学科配属の前は、学科ではなく学部に所属する。 */
export const FACULTY_ASSIGNMENT = '学部配属';

/**
 * 広島市立大学の学部構成。
 * 公開されている学修の手引き（2024年度入学生版。国際学科、情報科学部4学科、芸術学部2学科）に合わせた候補。
 * 情報科学部の1年は学科が決まっていないので「学部配属」を置く。大学院や改組後の名称は手入力する。
 */
export const ORG_TREE: readonly FacultyPreset[] = [
  {
    faculty: '国際学部',
    departments: ['国際学科'],
  },
  {
    faculty: '情報科学部',
    departments: [FACULTY_ASSIGNMENT, '情報工学科', '知能工学科', 'システム工学科', '医用情報科学科'],
  },
  {
    faculty: '芸術学部',
    departments: [
      '美術学科',
      '美術学科 日本画専攻',
      '美術学科 油絵専攻',
      '美術学科 彫刻専攻',
      'デザイン工芸学科',
    ],
  },
];

export function departmentsFor(faculty: string): readonly string[] {
  return ORG_TREE.find((item) => item.faculty === faculty)?.departments ?? [];
}

export function isPresetFaculty(faculty: string): boolean {
  return ORG_TREE.some((item) => item.faculty === faculty);
}

export function isFacultyAssignment(department: string): boolean {
  const text = department.normalize('NFKC').replace(/[\s\u3000]/g, '');
  return text === FACULTY_ASSIGNMENT || text.startsWith(`${FACULTY_ASSIGNMENT}（`);
}
