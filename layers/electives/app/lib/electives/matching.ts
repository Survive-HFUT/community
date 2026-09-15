import type { ElectiveCourse } from './types';

/** 与服务端保持一致的课程字段规范化。 */
export function normalizeCourseField(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/**
 * 教务处有些慕课由教师团队共同授课，教师字段会以「、」或斜杠分隔。
 * 课程列表仍只展示一条课程，但手填任一团队成员都应能命中这门课。
 */
function teacherNames(value: string): string[] {
  return value
    .split(/[、,，/／;；|｜]+/)
    .map(normalizeCourseField)
    .filter(Boolean);
}

export function matchesElectiveCourse(
  course: Pick<ElectiveCourse, 'name' | 'teacher'>,
  courseName: string,
  teacher: string,
): boolean {
  const name = normalizeCourseField(courseName);
  const inputTeacher = normalizeCourseField(teacher);
  if (!name || !inputTeacher) return false;
  if (normalizeCourseField(course.name) !== name) return false;

  const listedTeacher = normalizeCourseField(course.teacher);
  return (
    listedTeacher === inputTeacher ||
    teacherNames(course.teacher).includes(inputTeacher)
  );
}
