import { getWalineEnv } from '../../../../../waline/server/waline/context';
import { getCourseDetail } from '../../../electives/store';

/** GET /api/electives/courses/:id —— 课程详情（含全部评价） */
export default defineEventHandler(async (event) => {
  const { DB } = getWalineEnv(event);
  const id = getRouterParam(event, 'id') ?? '';
  const detail = await getCourseDetail(DB, id);

  if (!detail) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Course Not Found',
      data: { message: '课程不存在' },
    });
  }

  return { data: detail };
});
