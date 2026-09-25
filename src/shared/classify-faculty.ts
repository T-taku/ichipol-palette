import { ORG_TREE } from './org';
import { departmentMatches } from './normalize';

/** 候補一覧から、学科名に対応する学部を補う。手入力の大学院名称は対象外。 */
export function inferFaculty(department: string): string | undefined {
  const trimmed = department.trim();
  if (!trimmed) return undefined;
  for (const org of ORG_TREE) {
    if (org.departments.some((name) => departmentMatches(name, trimmed) || departmentMatches(trimmed, name))) {
      return org.faculty;
    }
  }
  return undefined;
}
