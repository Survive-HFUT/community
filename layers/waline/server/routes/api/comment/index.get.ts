import {
  adminCommentListResponse,
  commentCountResponse,
  commentListResponse,
  recentCommentsResponse,
} from '../../../waline/services/comments';
import { queryString, walineHandler } from '../../../waline/context';

/**
 * GET /api/comment
 *   ?type=recent  最近评论
 *   ?type=count   评论数（支持 path / path[] 多值）
 *   ?type=list    管理端分页列表
 *   （默认）      按 path 的线程化评论列表
 */
export default walineHandler((event) => {
  switch (queryString(event, 'type')) {
    case 'recent':
      return recentCommentsResponse(event);
    case 'count':
      return commentCountResponse(event);
    case 'list':
      return adminCommentListResponse(event);
    default:
      return commentListResponse(event);
  }
});
