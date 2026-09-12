import type {
  AssessmentForm,
  ElectiveCampus,
  ElectiveCategory,
  ElectiveScores,
  ElectiveType,
} from './types';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

/** 课程类型 */
export const ELECTIVE_TYPES: SelectOption<ElectiveType>[] = [
  { value: 'offline', label: '线下选修课' },
  { value: 'mooc', label: '线上慕课' },
  { value: 'pe', label: '体育课' },
  { value: 'cross_major', label: '跨专业选修课' },
];

/** 校区 */
export const ELECTIVE_CAMPUSES: SelectOption<ElectiveCampus>[] = [
  { value: 'tunxilu', label: '屯溪路校区' },
  { value: 'feicuihu', label: '翡翠湖校区' },
  { value: 'xuancheng', label: '宣城校区' },
];

/** 通识教育七大类别（仅线下选修课与线上慕课需要选择） */
export const ELECTIVE_CATEGORIES: SelectOption<ElectiveCategory>[] = [
  { value: 'philosophy', label: '哲学思想与批判性思维' },
  { value: 'literature', label: '文史经典及文化传承' },
  { value: 'science', label: '科技发展与科学精神' },
  { value: 'contemporary_china', label: '当代中国与社会责任' },
  { value: 'arts', label: '人文素养与艺术审美' },
  { value: 'ecology', label: '生态环境与可持续发展' },
  { value: 'international', label: '国际视野与文明发展' },
];

/** 考核形式 */
export const ASSESSMENT_FORMS: SelectOption<AssessmentForm>[] = [
  { value: 'written_exam', label: '线下笔试' },
  { value: 'in_class_online', label: '教室内线上做题' },
  { value: 'anytime_online', label: '不限地点自行完成' },
  { value: 'final_report', label: '期末报告' },
];

/** 只有这两类课程挂在通识教育七大类别下 */
export const CATEGORY_TYPES: ElectiveType[] = ['offline', 'mooc'];

/** 只有线上慕课需要填题数 */
export const QUESTIONS_TYPE: ElectiveType = 'mooc';

export interface ScoreDimension {
  key: keyof ElectiveScores;
  label: string;
  /** 1 分的含义 */
  low: string;
  /** 5 分的含义 */
  high: string;
}

/** 用户填写的五个 1–5 分维度（越高越好：分值越高越轻松 / 越省事） */
export const SCORE_DIMENSIONS: ScoreDimension[] = [
  { key: 'learnEase', label: '学习轻松度', low: '很难', high: '很轻松' },
  {
    key: 'highScoreEase',
    label: '高分容易度',
    low: '很难拿高分',
    high: '给分大方',
  },
  {
    key: 'checkinEase',
    label: '签到宽松度',
    low: '每节必签',
    high: '几乎不签到',
  },
  { key: 'homeworkEase', label: '作业轻松度', low: '非常多', high: '几乎没有' },
  { key: 'examEase', label: '考试轻松度', low: '很难', high: '很水' },
];

// ---------- 派生评分 ----------

/** 派生的综合评分在界面上的名字 */
export const OVERALL_SCORE_LABEL = '综合评分';

/** 一句话说明综合评分是怎么来的 */
export const OVERALL_SCORE_HINT = '五项评分的平均分，越高越推荐';

/**
 * 由五个维度换算综合评分（未取整）。
 *
 * 五个维度都是**越高越好**的刻度——分值越高越轻松 / 越省事
 * （例如「学习轻松度 5 = 很轻松」），
 * 所以直接取算术平均就得到 1–5 的综合评分，不需要再做换算。
 *
 * ⚠️ 入参必须是填好的 1–5 分值；没有评价时请由调用方直接返回 0。
 */
export function overallScore(scores: ElectiveScores): number {
  if (!SCORE_DIMENSIONS.length) return 0;

  const total = SCORE_DIMENSIONS.reduce(
    (sum, dimension) => sum + scores[dimension.key],
    0,
  );

  return total / SCORE_DIMENSIONS.length;
}

// ---------- 标签查询 ----------

function toLabelMap<T extends string>(
  options: SelectOption<T>[],
): Record<string, string> {
  return Object.fromEntries(
    options.map((option) => [option.value, option.label]),
  );
}

const TYPE_LABELS = toLabelMap(ELECTIVE_TYPES);
const CAMPUS_LABELS = toLabelMap(ELECTIVE_CAMPUSES);
const CATEGORY_LABELS = toLabelMap(ELECTIVE_CATEGORIES);
const ASSESSMENT_LABELS = toLabelMap(ASSESSMENT_FORMS);

export function electiveTypeLabel(value?: ElectiveType): string {
  return (value && TYPE_LABELS[value]) || '—';
}

export function campusLabel(value?: ElectiveCampus): string {
  return (value && CAMPUS_LABELS[value]) || '—';
}

export function categoryLabel(value?: ElectiveCategory): string {
  return (value && CATEGORY_LABELS[value]) || '—';
}

export function assessmentLabel(value?: AssessmentForm): string {
  return (value && ASSESSMENT_LABELS[value]) || '—';
}

// ---------- 学期 ----------

/** 学期字符串，格式 `2026-2027-1`（2026–2027 学年第 1 学期） */
export type Term = string;

/** 每学年从 9 月开学算起：9–12 月是第 1 学期，其余月份属于上一学年的第 2 学期 */
export function currentTerm(date: Date = new Date()): Term {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startYear = month >= 9 ? year : year - 1;
  const half = month >= 9 ? 1 : 2;
  return `${startYear}-${startYear + 1}-${half}`;
}

/** 从当前学期开始往前列出 `count` 个学期，供打分页下拉选择 */
export function recentTerms(count = 8, date: Date = new Date()): Term[] {
  const [startYear, , half] = currentTerm(date).split('-').map(Number);
  const terms: Term[] = [];
  let year = startYear ?? 0;
  let currentHalf = half ?? 1;

  for (let index = 0; index < count; index += 1) {
    terms.push(`${year}-${year + 1}-${currentHalf}`);
    if (currentHalf === 1) {
      year -= 1;
      currentHalf = 2;
    } else {
      currentHalf = 1;
    }
  }

  return terms;
}
