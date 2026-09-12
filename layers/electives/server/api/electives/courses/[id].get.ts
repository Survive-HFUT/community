import { getCourseDetail } from '../../../electives/store';

/** GET /api/electives/courses/:id —— 课程详情（含全部评价） */
export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const detail = getCourseDetail(id);

  if (!detail) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Course Not Found',
      data: { message: '课程不存在' },
    });
  }

  return { data: detail };
});
