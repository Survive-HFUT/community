import { and, eq, or } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import { getDb } from '../../../waline/server/database/client';
import {
  electiveCourses,
  electiveReviews,
  type ElectiveCourseRow,
  type ElectiveReviewRow,
} from '../../../waline/server/database/schema';
import {
  ASSESSMENT_FORMS,
  overallScore,
  SCORE_DIMENSIONS,
} from '../../app/lib/electives/constants';
import type {
  AssessmentForm,
  ElectiveCategory,
  ElectiveCourse,
  ElectiveCourseDetail,
  ElectiveCourseSummary,
  ElectiveReview,
  ElectiveReviewInput,
  ElectiveScores,
} from '../../app/lib/electives/types';
import { MOCK_COURSES, MOCK_REVIEWS } from './mock-data';

const SCORE_KEYS = SCORE_DIMENSIONS.map((dimension) => dimension.key);
const ASSESSMENT_KEYS = ASSESSMENT_FORMS.map((option) => option.value);
const ASSESSMENT_KEY_SET = new Set<string>(ASSESSMENT_KEYS);

/** 选修课评价存储：保留原有种子数据，并把新增课程与评价写入 D1。 */

export type CourseSort = 'score' | 'reviews' | 'ease' | 'name';

export interface CourseQuery {
  q?: string;
  type?: string;
  campus?: string;
  category?: string;
  sort?: CourseSort;
}

interface StoreSnapshot {
  courses: ElectiveCourse[];
  reviews: ElectiveReview[];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function emptyScores(): ElectiveScores {
  return {
    learnEase: 0,
    highScoreEase: 0,
    checkinEase: 0,
    homeworkEase: 0,
    examEase: 0,
  };
}

function emptyAssessmentCounts(): Record<AssessmentForm, number> {
  return Object.fromEntries(ASSESSMENT_KEYS.map((form) => [form, 0])) as Record<
    AssessmentForm,
    number
  >;
}

function courseIdentity(name: string, teacher: string): string {
  const normalize = (value: string) =>
    value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  return `${normalize(name)}\u0000${normalize(teacher)}`;
}

function courseFromRow(row: ElectiveCourseRow): ElectiveCourse {
  return {
    id: row.id,
    name: row.name,
    teacher: row.teacher,
    type: row.type as ElectiveCourse['type'],
    campus: row.campus as ElectiveCourse['campus'],
    category: row.category ? (row.category as ElectiveCategory) : undefined,
  };
}

function parseAssessment(value: string): AssessmentForm[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return [
      ...new Set(
        parsed.filter(
          (item): item is AssessmentForm =>
            typeof item === 'string' && ASSESSMENT_KEY_SET.has(item),
        ),
      ),
    ];
  } catch {
    // 历史脏数据不能阻塞整门课程详情，按未填写处理。
    return [];
  }
}

function reviewFromRow(row: ElectiveReviewRow): ElectiveReview {
  return {
    id: row.id,
    courseId: row.courseId,
    term: row.term,
    reviewer: {
      name: row.reviewerName,
      avatar: row.reviewerAvatar || undefined,
    },
    scores: {
      learnEase: row.learnEase,
      highScoreEase: row.highScoreEase,
      checkinEase: row.checkinEase,
      homeworkEase: row.homeworkEase,
      examEase: row.examEase,
    },
    questions: row.questions ?? undefined,
    assessment: parseAssessment(row.assessment),
    comment: row.comment || undefined,
    createdAt: row.createdAt,
  };
}

/** 读取 D1 并合并种子数据，D1 中同身份的核心字段优先。 */
async function loadSnapshot(d1: D1Database): Promise<StoreSnapshot> {
  const db = getDb(d1);
  const [courseRows, reviewRows] = await Promise.all([
    db.select().from(electiveCourses),
    db.select().from(electiveReviews),
  ]);

  const coursesByIdentity = new Map<string, ElectiveCourse>();
  for (const course of MOCK_COURSES) {
    coursesByIdentity.set(courseIdentity(course.name, course.teacher), {
      ...course,
    });
  }
  for (const row of courseRows) {
    const persisted = courseFromRow(row);
    const identity = courseIdentity(persisted.name, persisted.teacher);
    coursesByIdentity.set(identity, persisted);
  }

  const reviewsById = new Map<string, ElectiveReview>();
  for (const review of MOCK_REVIEWS) {
    reviewsById.set(review.id, {
      ...review,
      scores: { ...review.scores },
      assessment: [...review.assessment],
    });
  }
  for (const row of reviewRows) {
    reviewsById.set(row.id, reviewFromRow(row));
  }

  return {
    courses: [...coursesByIdentity.values()],
    reviews: [...reviewsById.values()],
  };
}

/** 把一门课的评价聚合成列表项数据。 */
export function computeSummary(
  course: ElectiveCourse,
  list: ElectiveReview[],
): ElectiveCourseSummary {
  const averages = emptyScores();
  const assessmentCounts = emptyAssessmentCounts();

  let questionSum = 0;
  let questionCount = 0;
  let scoreSum = 0;
  let latestReviewAt: string | undefined;

  for (const review of list) {
    for (const key of SCORE_KEYS) averages[key] += review.scores[key];

    // 综合评分 = 每条评价五个维度的平均值，再对所有评价求平均。
    scoreSum += overallScore(review.scores);

    for (const form of review.assessment) {
      if (form in assessmentCounts) assessmentCounts[form] += 1;
    }

    if (typeof review.questions === 'number') {
      questionSum += review.questions;
      questionCount += 1;
    }

    if (!latestReviewAt || review.createdAt > latestReviewAt) {
      latestReviewAt = review.createdAt;
    }
  }

  if (list.length) {
    for (const key of SCORE_KEYS) {
      averages[key] = round1(averages[key] / list.length);
    }
  }

  return {
    course,
    reviewCount: list.length,
    averages,
    score: list.length ? round1(scoreSum / list.length) : 0,
    assessmentCounts,
    averageQuestions: questionCount
      ? round1(questionSum / questionCount)
      : undefined,
    latestReviewAt,
  };
}

function sortSummaries(
  list: ElectiveCourseSummary[],
  sort: CourseSort = 'score',
): ElectiveCourseSummary[] {
  const sorted = [...list];

  switch (sort) {
    case 'reviews':
      sorted.sort((a, b) => b.reviewCount - a.reviewCount || b.score - a.score);
      break;
    case 'ease':
      sorted.sort((a, b) => b.averages.learnEase - a.averages.learnEase);
      break;
    case 'name':
      sorted.sort((a, b) =>
        a.course.name.localeCompare(b.course.name, 'zh-Hans-CN'),
      );
      break;
    default:
      sorted.sort((a, b) => b.score - a.score || b.reviewCount - a.reviewCount);
  }

  return sorted;
}

/** 课程总览：筛选 + 排序后返回聚合结果。 */
export async function queryCourseSummaries(
  d1: D1Database,
  query: CourseQuery = {},
): Promise<ElectiveCourseSummary[]> {
  const snapshot = await loadSnapshot(d1);
  const keyword = (query.q ?? '').trim().toLowerCase();
  const type = query.type && query.type !== 'all' ? query.type : undefined;
  const campus =
    query.campus && query.campus !== 'all' ? query.campus : undefined;
  const category =
    query.category && query.category !== 'all' ? query.category : undefined;

  const summaries = snapshot.courses
    .filter((course) => {
      if (keyword) {
        const haystack = `${course.name} ${course.teacher}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      if (type && course.type !== type) return false;
      if (campus && course.campus !== campus) return false;
      if (category && course.category !== category) return false;
      return true;
    })
    .map((course) =>
      computeSummary(
        course,
        snapshot.reviews.filter((review) => review.courseId === course.id),
      ),
    );

  return sortSummaries(summaries, query.sort);
}

/** 课程详情：聚合结果 + 按时间倒序的全部评价。 */
export async function getCourseDetail(
  d1: D1Database,
  id: string,
): Promise<ElectiveCourseDetail | null> {
  const snapshot = await loadSnapshot(d1);
  const course = snapshot.courses.find((item) => item.id === id);
  if (!course) return null;

  const list = snapshot.reviews
    .filter((review) => review.courseId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return { ...computeSummary(course, list), reviews: list };
}

function newCourseId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function newReviewId(courseId: string): string {
  return `${courseId}-r${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** 确保课程已写入 D1，并返回数据库中的规范记录。 */
async function persistCourse(
  d1: D1Database,
  course: ElectiveCourse,
): Promise<ElectiveCourse> {
  const db = getDb(d1);
  await db
    .insert(electiveCourses)
    .values({
      id: course.id,
      name: course.name,
      teacher: course.teacher,
      type: course.type,
      campus: course.campus,
      category: course.category ?? null,
    })
    .onConflictDoNothing();

  const row = await db
    .select()
    .from(electiveCourses)
    .where(
      or(
        eq(electiveCourses.id, course.id),
        and(
          eq(electiveCourses.name, course.name),
          eq(electiveCourses.teacher, course.teacher),
        ),
      ),
    )
    .get();

  return row ? courseFromRow(row) : course;
}

/** 按 id 或「课程名 + 教师」匹配课程；匹配不到就新建一门。 */
async function resolveCourse(
  d1: D1Database,
  input: ElectiveReviewInput,
): Promise<ElectiveCourse> {
  const snapshot = await loadSnapshot(d1);
  const name = input.courseName.trim();
  const teacher = input.teacher.trim();
  const identity = courseIdentity(name, teacher);

  const byId = input.courseId
    ? snapshot.courses.find((course) => course.id === input.courseId)
    : undefined;
  const byIdentity = snapshot.courses.find((course) =>
    courseIdentity(course.name, course.teacher) === identity,
  );
  const matched =
    byId && courseIdentity(byId.name, byId.teacher) === identity
      ? byId
      : byIdentity;

  const course =
    matched ??
    ({
      id: newCourseId(),
      name,
      teacher,
      type: input.type,
      campus: input.campus,
      category: input.category,
    } satisfies ElectiveCourse);

  return persistCourse(d1, course);
}

/** 新增一条评价，课程与评价均持久化到 D1。 */
export async function addReview(
  d1: D1Database,
  input: ElectiveReviewInput,
  author: { id: number; name: string; avatar?: string },
): Promise<ElectiveReview> {
  const course = await resolveCourse(d1, input);
  const assessment = [...new Set(input.assessment)];
  const created: ElectiveReview = {
    id: newReviewId(course.id),
    courseId: course.id,
    term: input.term,
    reviewer: { name: author.name, avatar: author.avatar },
    scores: { ...input.scores },
    questions: input.questions,
    assessment,
    comment: input.comment?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  const db = getDb(d1);
  await db.insert(electiveReviews).values({
    id: created.id,
    courseId: created.courseId,
    userId: author.id,
    term: created.term,
    reviewerName: created.reviewer.name,
    reviewerAvatar: created.reviewer.avatar ?? null,
    learnEase: created.scores.learnEase,
    highScoreEase: created.scores.highScoreEase,
    checkinEase: created.scores.checkinEase,
    homeworkEase: created.scores.homeworkEase,
    examEase: created.scores.examEase,
    questions: created.questions ?? null,
    assessment: JSON.stringify(assessment),
    comment: created.comment ?? null,
    createdAt: created.createdAt,
  });

  return created;
}
