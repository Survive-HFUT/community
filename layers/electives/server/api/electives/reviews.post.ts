import {
  ASSESSMENT_FORMS,
  CATEGORY_TYPES,
  ELECTIVE_CAMPUSES,
  ELECTIVE_CATEGORIES,
  ELECTIVE_TYPES,
  QUESTIONS_TYPE,
  SCORE_DIMENSIONS,
} from '../../../app/lib/electives/constants';
import type {
  AssessmentForm,
  ElectiveCampus,
  ElectiveCategory,
  ElectiveScores,
  ElectiveType,
} from '../../../app/lib/electives/types';
// 复用 waline layer 的鉴权中间件写入的登录态（见 server/middleware/01.waline-auth.ts）
import {
  getWalineEnv,
  requireUser,
} from '../../../../waline/server/waline/context';
import { addReview } from '../../electives/store';

/** 中文提示放在 `data.message`，`statusMessage` 保持 ASCII */
function badRequest(message: string) {
  return createError({
    statusCode: 400,
    statusMessage: 'Bad Request',
    data: { message },
  });
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * POST /api/electives/reviews —— 提交一条选修课评价（需登录）
 *
 * 课程按 `courseId` 或「课程名 + 教师」匹配，匹配不到会新建一门课程；
 * 课程和评价都会写入 D1。
 */
export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const { DB } = getWalineEnv(event);
  const body = ((await readBody(event)) ?? {}) as Record<string, unknown>;

  const courseName = readString(body.courseName);
  const teacher = readString(body.teacher);
  const term = readString(body.term);

  if (!courseName) throw badRequest('请填写课程名称');
  if (!teacher) throw badRequest('请填写任课教师');
  if (!/^\d{4}-\d{4}-[12]$/.test(term)) throw badRequest('学期格式不正确');

  const type = readString(body.type) as ElectiveType;
  if (!ELECTIVE_TYPES.some((option) => option.value === type)) {
    throw badRequest('课程类型不正确');
  }

  const campus = readString(body.campus) as ElectiveCampus;
  if (!ELECTIVE_CAMPUSES.some((option) => option.value === campus)) {
    throw badRequest('校区不正确');
  }

  const categoryInput = readString(body.category) as ElectiveCategory;
  const category =
    CATEGORY_TYPES.includes(type) &&
    ELECTIVE_CATEGORIES.some((option) => option.value === categoryInput)
      ? categoryInput
      : undefined;
  if (CATEGORY_TYPES.includes(type) && !category) {
    throw badRequest('请选择通识教育类别');
  }

  const scoresInput = (body.scores ?? {}) as Record<string, unknown>;
  const scores = {} as ElectiveScores;
  for (const dimension of SCORE_DIMENSIONS) {
    const value = Number(scoresInput[dimension.key]);
    if (
      !Number.isFinite(value) ||
      !Number.isInteger(value * 2) ||
      value < 1 ||
      value > 5
    ) {
      throw badRequest(`请为「${dimension.label}」打分（1–5 星）`);
    }
    scores[dimension.key] = value;
  }

  const assessment = Array.isArray(body.assessment)
    ? [
        ...new Set(
          body.assessment.filter(
            (value): value is AssessmentForm =>
              typeof value === 'string' &&
              ASSESSMENT_FORMS.some((option) => option.value === value),
          ),
        ),
      ]
    : [];
  if (!assessment.length) throw badRequest('请至少选择一种考核形式');

  // 题数只有线上慕课需要，且允许留空
  let questions: number | undefined;
  if (
    type === QUESTIONS_TYPE &&
    body.questions !== undefined &&
    body.questions !== null &&
    body.questions !== ''
  ) {
    const value = Number(body.questions);
    if (!Number.isInteger(value) || value <= 0 || value > 500) {
      throw badRequest('题数需要是 1–500 之间的整数');
    }
    questions = value;
  }

  const review = await addReview(
    DB,
    {
      courseId: readString(body.courseId) || undefined,
      courseName,
      teacher,
      type,
      campus,
      category,
      term,
      scores,
      questions,
      assessment,
      comment: readString(body.comment).slice(0, 1000) || undefined,
    },
    {
      id: user.objectId,
      name: user.display_name || user.email,
      avatar: user.avatar || undefined,
    },
  );

  return { data: review };
});
