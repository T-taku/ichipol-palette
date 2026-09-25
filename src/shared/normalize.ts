export type OrgKind = '学部' | '学科' | '専攻' | '研究科';

export interface OrgUnit {
  kind: OrgKind;
  name: string;
}

export function normalize(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[\s\u3000]+/g, '')
    .replace(/[・･]/g, '')
    .trim();
}

export function extractUnits(text: string): OrgUnit[] {
  const source = normalize(text);
  const re = /([0-9A-Za-z\u30A0-\u30FF\u4E00-\u9FFFー]{2,40}?)(研究科|学部|学科|専攻)/g;
  const units: OrgUnit[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    units.push({ kind: match[2] as OrgKind, name: match[1] + match[2] });
  }
  return units;
}

function sharedKindConflict(courseUnits: OrgUnit[], userUnits: OrgUnit[]): boolean | 'none' {
  const shared = userUnits.filter((unit) => courseUnits.some((course) => course.kind === unit.kind));
  if (shared.length === 0) return 'none';
  const conflict = shared.some((unit) => {
    const sameKind = courseUnits.filter((course) => course.kind === unit.kind);
    return !sameKind.some((course) => course.name === unit.name);
  });
  return conflict;
}

/** 開講表記とユーザの学科名が同じ組織を指すか。学部だけの一致はここでは真にしない。 */
export function departmentMatches(courseText: string, userDepartment: string): boolean {
  const course = normalize(courseText);
  const user = normalize(userDepartment);
  if (!course || !user) return false;
  if (course === user) return true;

  const courseUnits = extractUnits(course);
  const userUnits = extractUnits(user);
  if (courseUnits.length > 0 && userUnits.length > 0) {
    const conflict = sharedKindConflict(courseUnits, userUnits);
    if (conflict === 'none') return false;
    return !conflict;
  }

  const shorter = course.length <= user.length ? course : user;
  const longer = course.length <= user.length ? user : course;
  if (shorter.length < 4) return false;
  return longer.includes(shorter);
}

export function facultyMatches(courseText: string, userFaculty: string): boolean {
  const courseUnits = extractUnits(courseText).filter((unit) => unit.kind === '学部' || unit.kind === '研究科');
  const userUnits = extractUnits(userFaculty).filter((unit) => unit.kind === '学部' || unit.kind === '研究科');
  if (courseUnits.length > 0 && userUnits.length > 0) {
    return userUnits.some((unit) =>
      courseUnits.some((course) => course.kind === unit.kind && course.name === unit.name),
    );
  }
  return departmentMatches(courseText, userFaculty);
}

export function hasSpecificDepartment(text: string): boolean {
  return extractUnits(text).some((unit) => unit.kind === '学科' || unit.kind === '専攻');
}
