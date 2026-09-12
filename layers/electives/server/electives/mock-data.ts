import type {
  AssessmentForm,
  ElectiveCourse,
  ElectiveReview,
} from '../../app/lib/electives/types';

const DAY = 24 * 60 * 60 * 1000;

/**
 * 固定基准时间。
 *
 * mock 的 createdAt 必须由固定基准推算，不能依赖 `Date.now()`；
 * 否则同一份种子数据在构建期 / 运行期、不同 isolate 上会漂移。
 */
const BASE_TIME = Date.parse('2026-09-01T08:00:00+08:00');

/** 课程元信息种子数据 */
export const MOCK_COURSES: ElectiveCourse[] = [
  {
    id: 'film-art',
    name: '电影艺术鉴赏',
    teacher: '王丽',
    type: 'offline',
    campus: 'tunxilu',
    category: 'arts',
  },
  {
    id: 'pre-qin',
    name: '先秦诸子导读',
    teacher: '陈明',
    type: 'offline',
    campus: 'feicuihu',
    category: 'literature',
  },
  {
    id: 'ai-intro',
    name: '人工智能导论',
    teacher: '刘洋',
    type: 'mooc',
    campus: 'feicuihu',
    category: 'science',
  },
  {
    id: 'innovation',
    name: '创新创业基础',
    teacher: '赵敏',
    type: 'offline',
    campus: 'tunxilu',
    category: 'contemporary_china',
  },
  {
    id: 'western-philosophy',
    name: '西方哲学史',
    teacher: '郑霞',
    type: 'offline',
    campus: 'xuancheng',
    category: 'philosophy',
  },
  {
    id: 'music-appreciation',
    name: '音乐鉴赏',
    teacher: '孙悦',
    type: 'offline',
    campus: 'xuancheng',
    category: 'arts',
  },
  {
    id: 'ecology-sd',
    name: '生态与可持续发展',
    teacher: '周航',
    type: 'offline',
    campus: 'feicuihu',
    category: 'ecology',
  },
  {
    id: 'cross-culture',
    name: '跨文化交际',
    teacher: '张薇',
    type: 'mooc',
    campus: 'tunxilu',
    category: 'international',
  },
  {
    id: 'basketball',
    name: '篮球',
    teacher: '李强',
    type: 'pe',
    campus: 'feicuihu',
  },
  {
    id: 'digital-media',
    name: '数字媒体设计',
    teacher: '吴涛',
    type: 'cross_major',
    campus: 'tunxilu',
  },
  // 新开课程：用来验证「还没有评价」的空状态
  {
    id: 'swimming',
    name: '游泳',
    teacher: '何静',
    type: 'pe',
    campus: 'xuancheng',
  },
];

/**
 * [学习轻松度, 高分容易度, 签到宽松度, 作业轻松度, 考试轻松度]，每项 1–5。
 * 采用「越高越好」的刻度：分值越高越轻松 / 越省事。
 */
type ScoreTuple = [number, number, number, number, number];

let sequence = 0;

function review(
  courseId: string,
  student: string,
  term: string,
  scores: ScoreTuple,
  assessment: AssessmentForm[],
  comment: string,
  options: { questions?: number; daysAgo?: number } = {},
): ElectiveReview {
  const [learnEase, highScoreEase, checkinEase, homeworkEase, examEase] =
    scores;

  sequence += 1;

  return {
    id: `${courseId}-r${sequence}`,
    courseId,
    term,
    reviewer: { name: student },
    scores: {
      learnEase,
      highScoreEase,
      checkinEase,
      homeworkEase,
      examEase,
    },
    questions: options.questions,
    assessment,
    comment,
    createdAt: new Date(
      BASE_TIME - (options.daysAgo ?? 30) * DAY,
    ).toISOString(),
  };
}

/** 评价种子数据 */
export const MOCK_REVIEWS: ElectiveReview[] = [
  // 电影艺术鉴赏
  review(
    'film-art',
    '林晓',
    '2025-2026-1',
    [5, 4, 4, 5, 5],
    ['final_report'],
    '老师放的片子都很经典，平日不点名，期末交一篇影评就行，给分很高。',
    { daysAgo: 330 },
  ),
  review(
    'film-art',
    '王浩然',
    '2024-2025-2',
    [4, 3, 3, 4, 4],
    ['final_report'],
    '每节课都要签到，影评想拿高分得认真写，不能糊弄。',
    { daysAgo: 480 },
  ),
  review(
    'film-art',
    '张一诺',
    '2025-2026-2',
    [5, 5, 4, 5, 5],
    ['final_report'],
    '强烈推荐，又能看电影又轻松，公认的水课。',
    { daysAgo: 150 },
  ),

  // 先秦诸子导读
  review(
    'pre-qin',
    '陈思远',
    '2025-2026-1',
    [3, 2, 2, 3, 3],
    ['written_exam', 'final_report'],
    '老师要求读原文，考试虽然开卷但题目很活，得真读懂才行。',
    { daysAgo: 320 },
  ),
  review(
    'pre-qin',
    '李梦',
    '2024-2025-1',
    [2, 2, 1, 2, 2],
    ['written_exam'],
    '想混学分的建议避开，但愿意认真读点书的话收获很大。',
    { daysAgo: 640 },
  ),
  review(
    'pre-qin',
    '赵一鸣',
    '2025-2026-2',
    [3, 2, 2, 3, 2],
    ['final_report'],
    '每周一段读后感，量不算大，老师批改很认真。',
    { daysAgo: 140 },
  ),

  // 人工智能导论（线上慕课）
  review(
    'ai-intro',
    '周雨',
    '2025-2026-1',
    [4, 4, 5, 3, 4],
    ['anytime_online'],
    '刷完视频就能考，20 道选择题，随时都能做，非常轻松。',
    { daysAgo: 310, questions: 20 },
  ),
  review(
    'ai-intro',
    '吴迪',
    '2024-2025-2',
    [4, 3, 5, 3, 3],
    ['anytime_online'],
    '视频有点多但能倍速，题目不难，就是得留意截止时间。',
    { daysAgo: 470, questions: 25 },
  ),
  review(
    'ai-intro',
    '徐静',
    '2025-2026-2',
    [5, 5, 5, 4, 4],
    ['anytime_online', 'final_report'],
    '性价比之王，闭眼冲，唯一的缺点是认真学不到太多东西。',
    { daysAgo: 130, questions: 20 },
  ),

  // 创新创业基础
  review(
    'innovation',
    '何伟',
    '2025-2026-1',
    [4, 4, 1, 2, 4],
    ['in_class_online', 'final_report'],
    '每节课都签到，小组作业偏多，期末交一份商业计划书。',
    { daysAgo: 300 },
  ),
  review(
    'innovation',
    '郑好',
    '2024-2025-2',
    [3, 3, 1, 1, 3],
    ['final_report'],
    '作业量真的大，不过组队时划划水也能过。',
    { daysAgo: 460 },
  ),

  // 西方哲学史
  review(
    'western-philosophy',
    '孙悦然',
    '2025-2026-1',
    [2, 2, 3, 3, 2],
    ['written_exam'],
    '老师讲得很投入，考试要记人名和观点，建议平时就做笔记。',
    { daysAgo: 290 },
  ),
  review(
    'western-philosophy',
    '高翔',
    '2024-2025-1',
    [1, 1, 3, 2, 1],
    ['written_exam'],
    '难度确实高，非哲学爱好者慎选，我是被名字骗进来的。',
    { daysAgo: 630 },
  ),

  // 音乐鉴赏
  review(
    'music-appreciation',
    '马晓东',
    '2025-2026-2',
    [5, 5, 4, 5, 5],
    ['final_report'],
    '上课就是听音乐，期末写一篇听后感，给分特别大方。',
    { daysAgo: 120 },
  ),

  // 生态与可持续发展
  review(
    'ecology-sd',
    '林晓',
    '2025-2026-2',
    [4, 3, 3, 4, 3],
    ['in_class_online', 'final_report'],
    '课堂上用手机做题，期末再交个报告，整体比较轻松。',
    { daysAgo: 110 },
  ),
  review(
    'ecology-sd',
    '李梦',
    '2025-2026-1',
    [3, 3, 2, 3, 3],
    ['written_exam'],
    '内容挺有意思，就是签到比较勤，偶尔会点名提问。',
    { daysAgo: 280 },
  ),

  // 跨文化交际（线上慕课）
  review(
    'cross-culture',
    '陈思远',
    '2025-2026-1',
    [4, 4, 5, 4, 4],
    ['anytime_online'],
    '题目有点多，30 道，不过可以边查边做。',
    { daysAgo: 270, questions: 30 },
  ),
  review(
    'cross-culture',
    '王浩然',
    '2024-2025-2',
    [4, 3, 5, 4, 3],
    ['anytime_online', 'final_report'],
    '材料全英文，读起来会慢一些，其他都还好。',
    { daysAgo: 450, questions: 30 },
  ),

  // 篮球（体育课）
  review(
    'basketball',
    '吴迪',
    '2025-2026-1',
    [4, 4, 1, 5, 4],
    ['in_class_online'],
    '每节课签到加考勤，期末是投篮测试，几乎不会挂。',
    { daysAgo: 260 },
  ),
  review(
    'basketball',
    '郑好',
    '2025-2026-2',
    [4, 4, 1, 5, 4],
    ['in_class_online'],
    '喜欢打球的闭眼选，不喜欢运动的会有点难受。',
    { daysAgo: 100 },
  ),

  // 数字媒体设计（跨专业选修课）
  review(
    'digital-media',
    '周雨',
    '2025-2026-2',
    [3, 3, 3, 2, 3],
    ['written_exam', 'final_report'],
    '跨专业选的人不少，期末要交作品，花点时间但挺有成就感。',
    { daysAgo: 90 },
  ),
  review(
    'digital-media',
    '徐静',
    '2024-2025-1',
    [2, 2, 3, 2, 2],
    ['final_report'],
    '需要一点软件基础，零基础的话前期会比较吃力。',
    { daysAgo: 620 },
  ),
  review(
    'digital-media',
    '高翔',
    '2025-2026-1',
    [3, 2, 3, 2, 3],
    ['written_exam'],
    '作业是做一个短视频，挺花时间的，但难度不高。',
    { daysAgo: 250 },
  ),
];
