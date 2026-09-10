import { deleteCommentResponse } from '../../../waline/services/comments';
import { walineHandler } from '../../../waline/context';

/** DELETE /api/comment/:id —— 级联删除评论及其回复（仅管理员） */
export default walineHandler((event) => {
  const id = Number(getRouterParam(event, 'id'));
  return deleteCommentResponse(event, id);
});
