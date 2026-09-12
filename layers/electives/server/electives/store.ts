import {
  ASSESSMENT_FORMS,
  overallScore,
  SCORE_DIMENSIONS,
} from '../../app/lib/electives/constants';
import type {
  AssessmentForm,
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

/**
 * 模块级内存存储。
 *
 * ⚠️ 这是 mock 实现：数据只活在当前的 Worker isolate / dev server 进程里，
 * 不落 D1。重新部署、或生产环境命中另一个 isolate，就会回到种子数据。
 *
 * 将来接数据库时，只要把本文件的函数换成 `server/database/**` 里的仓储实现，
 * 路由和前端都不需要改动。
 */
const courses: ElectiveCourse[] = MOCK_COURSES.map((course) => ({ ...course }));

const reviews: ElectiveReview[] = MOCK_REVIEWS.map((review) => ({
  ...review,
  scores: { ...review.scores },
  assessment: [...review.assessment],
}));

export type CourseSort = 'score' | 'reviews' | 'ease' | 'name';

export interface CourseQuery {
  q?: string;
  type?: string;
  campus?: string;
  category?: string;
  sort?: CourseSort;
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

/** 把一门课的评价聚合成列表项数据 */
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
    // 维度本身是「越高越好」的刻度，所以这里不需要再做换算。
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

function reviewsOf(courseId: string): ElectiveReview[] {
  return reviews.filter((review) => review.courseId === courseId);
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
      // 降序 = 学习轻松度高的（最容易的）在最前；
      // 没有评价的课程均分为 0，自然落在最后。
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

/** 课程总览：筛选 + 排序后返回聚合结果 */
export function queryCourseSummaries(
  query: CourseQuery = {},
): ElectiveCourseSummary[] {
  const keyword = (query.q ?? '').trim().toLowerCase();
  const type = query.type && query.type !== 'all' ? query.type : undefined;
  const campus =
    query.campus && query.campus !== 'all' ? query.campus : undefined;
  const category =
    query.category && query.category !== 'all' ? query.category : undefined;

  const summaries = courses
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
    .map((course) => computeSummary(course, reviewsOf(course.id)));

  return sortSummaries(summaries, query.sort);
}

/** 课程详情：聚合结果 + 按时间倒序的全部评价 */
export function getCourseDetail(id: string): ElectiveCourseDetail | null {
  const course = courses.find((item) => item.id === id);
  if (!course) return null;

  const list = reviewsOf(id).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return { ...computeSummary(course, list), reviews: list };
}

/** 按 id 或「课程名 + 教师」匹配课程；匹配不到就新建一门 */
function resolveCourse(input: ElectiveReviewInput): ElectiveCourse {
  if (input.courseId) {
    const byId = courses.find((course) => course.id === input.courseId);
    if (byId) return byId;
  }

  const name = input.courseName.trim();
  const teacher = input.teacher.trim();

  const byName = courses.find(
    (course) => course.name === name && course.teacher === teacher,
  );
  if (byName) return byName;

  const created: ElectiveCourse = {
    id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    teacher,
    type: input.type,
    campus: input.campus,
    category: input.category,
  };

  courses.push(created);
  return created;
}

/** 新增一条评价（仅写入内存，见文件顶部说明） */
export function addReview(
  input: ElectiveReviewInput,
  author: { name: string; avatar?: string },
): ElectiveReview {
  const course = resolveCourse(input);

  const created: ElectiveReview = {
    id: `${course.id}-r${Date.now().toString(36)}`,
    courseId: course.id,
    term: input.term,
    reviewer: { name: author.name, avatar: author.avatar },
    scores: { ...input.scores },
    questions: input.questions,
    assessment: [...input.assessment],
    comment: input.comment?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  reviews.push(created);
  return created;
}
