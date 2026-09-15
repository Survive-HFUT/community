/**
 * 选修课评价的领域类型。
 *
 * 这份文件同时被前端（`app/**`）与 mock 服务端（`server/**`）引用：
 * 服务端一律用 `import type` 做**类型导入**，编译后会被完全擦除，
 * 因此不会把前端代码打进 Nitro 产物。
 */

/** 课程类型 */
export type ElectiveType = 'offline' | 'mooc' | 'pe' | 'cross_major';

/** 校区 */
export type ElectiveCampus = 'tunxilu' | 'feicuihu' | 'xuancheng';

/** 通识教育七大类别（仅线下选修课与线上慕课有） */
export type ElectiveCategory =
  | 'philosophy'
  | 'literature'
  | 'science'
  | 'contemporary_china'
  | 'arts'
  | 'ecology'
  | 'international';

/** 考核形式 */
export type AssessmentForm =
  'written_exam' | 'in_class_online' | 'anytime_online' | 'final_report';

/**
 * 用户填写的五个 1–5 分维度。
 *
 * 五项都是**越高越好**的刻度：分值越高代表越轻松 / 越省事
 * （例如「学习轻松度 5」= 很轻松，「签到宽松度 5」= 几乎不签到）。
 * 因此五项直接取平均就是「综合评分」，越高越值得推荐，见 `constants.ts` 的 `overallScore()`。
 */
export interface ElectiveScores {
  /** 学习轻松度：1 很难 → 5 很轻松 */
  learnEase: number;
  /** 高分容易度：1 很难拿高分 → 5 给分大方 */
  highScoreEase: number;
  /** 签到宽松度：1 每节必签 → 5 几乎不签到 */
  checkinEase: number;
  /** 作业轻松度：1 非常多 → 5 几乎没有 */
  homeworkEase: number;
  /** 考试轻松度：1 很难 → 5 很水 */
  examEase: number;
}

/** 课程元信息（不随具体评价变化的部分） */
export interface ElectiveCourse {
  id: string;
  name: string;
  teacher: string;
  type: ElectiveType;
  campus: ElectiveCampus;
  /** 仅 `offline` / `mooc` 有 */
  category?: ElectiveCategory;
  /** 教务处课程代码；用户新建的课程可能没有该字段 */
  courseCode?: string;
  /** 官方目录中的学分；跨专业介绍未提供时为空 */
  credits?: number;
  /** 开课部门或来源专业所属院系 */
  department?: string;
  /** 该条目录快照对应的学期 */
  sourceTerm?: string;
  /** 官方通知或附件地址 */
  sourceUrl?: string;
}

/** 一条课程评价 */
export interface ElectiveReview {
  id: string;
  courseId: string;
  /** 学期，格式 `2026-2027-1` */
  term: string;
  reviewer: {
    name: string;
    avatar?: string;
  };
  scores: ElectiveScores;
  /** 题数，仅线上慕课 */
  questions?: number;
  /** 本次经历遇到的考核形式，可多选 */
  assessment: AssessmentForm[];
  comment?: string;
  createdAt: string;
}

/** 列表用的聚合结果 */
export interface ElectiveCourseSummary {
  course: ElectiveCourse;
  reviewCount: number;
  /** 五个维度的均分（保留 1 位小数）；没有评价时全部为 0 */
  averages: ElectiveScores;
  /**
   * 综合评分（保留 1 位小数）= 五个维度的平均分，越高越推荐。
   * 没有评价时为 0，也是总览页的默认排序依据。
   */
  score: number;
  /** 各考核形式被提到的次数 */
  assessmentCounts: Record<AssessmentForm, number>;
  /** 线上慕课的平均题数（保留 1 位小数），无数据时为 undefined */
  averageQuestions?: number;
  /** 最近一条评价的时间 */
  latestReviewAt?: string;
}

/** 详情页数据 = 聚合结果 + 全部评价 */
export interface ElectiveCourseDetail extends ElectiveCourseSummary {
  reviews: ElectiveReview[];
}

/** 提交评价的请求体 */
export interface ElectiveReviewInput {
  /** 命中已有课程时传它的 id */
  courseId?: string;
  /** 课程名与任课教师用于匹配已有课程，匹配不到则新建 */
  courseName: string;
  teacher: string;
  type: ElectiveType;
  campus: ElectiveCampus;
  category?: ElectiveCategory;
  term: string;
  scores: ElectiveScores;
  questions?: number;
  assessment: AssessmentForm[];
  comment?: string;
}
