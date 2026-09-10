import { updateCommentResponse } from '../../../waline/services/comments';
import { walineHandler } from '../../../waline/context';

/** PUT /api/comment/:id —— 点赞（任何人）/ 审核、置顶、改字段（仅管理员） */
export default walineHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  const body = await readBody(event);
  return updateCommentResponse(event, id, body ?? {});
});
