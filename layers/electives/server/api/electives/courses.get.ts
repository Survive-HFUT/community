import { getWalineEnv } from '../../../../waline/server/waline/context';
import { queryCourseSummaries, type CourseSort } from '../../electives/store';

const SORTS: CourseSort[] = ['score', 'reviews', 'ease', 'name'];

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * GET /api/electives/courses —— 课程总览（含聚合评分）
 *
 * query：
 *   - `q`        关键词，匹配课程名与任课教师
 *   - `type`     课程类型；`all` 或留空表示不限
 *   - `campus`   校区；`all` 或留空表示不限
 *   - `category` 通识教育类别；`all` 或留空表示不限
 *   - `sort`     `score`（默认，综合评分）| `reviews` | `ease` | `name`
 */
export default defineEventHandler(async (event) => {
  const { DB } = getWalineEnv(event);
  const query = getQuery(event);
  const sort = readString(query.sort) as CourseSort | undefined;

  const data = await queryCourseSummaries(DB, {
    q: readString(query.q),
    type: readString(query.type),
    campus: readString(query.campus),
    category: readString(query.category),
    sort: sort && SORTS.includes(sort) ? sort : 'score',
  });

  return { data, total: data.length };
});
