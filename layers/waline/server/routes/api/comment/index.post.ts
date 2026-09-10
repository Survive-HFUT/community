import { createCommentResponse } from '../../../waline/services/comments';
import { walineHandler } from '../../../waline/context';

/** POST /api/comment —— 发表评论（本项目强制登录） */
export default walineHandler(async (event) => {
  const body = await readBody(event);
  return createCommentResponse(event, body ?? {});
});
