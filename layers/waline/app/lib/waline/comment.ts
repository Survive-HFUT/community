import { request } from './client';
import type { Comment, CommentListResp, CommentStatus } from './types';

export interface CommentFilter {
  page?: number;
  pageSize?: number;
  status?: CommentStatus | '';
  keyword?: string;
  owner?: 'mine' | '';
}

/** GET /api/comment?type=list —— 管理端评论列表 */
export function getCommentList(
  filter: CommentFilter = {},
): Promise<CommentListResp> {
  return request<CommentListResp>('/comment', {
    query: {
      type: 'list',
      page: filter.page ?? 1,
      pageSize: filter.pageSize ?? 20,
      status: filter.status || '',
      keyword: filter.keyword || '',
      owner: filter.owner || '',
    },
  });
}

/** PUT /api/comment/:id —— 审核（状态 / 置顶 / 字段） */
export function updateComment(
  id: string | number,
  data: Record<string, unknown>,
): Promise<Comment> {
  return request<Comment>(`/comment/${id}`, { method: 'PUT', body: data });
}

/** DELETE /api/comment/:id —— 删除评论（级联删除回复） */
export function deleteComment(id: string | number): Promise<unknown> {
  return request(`/comment/${id}`, { method: 'DELETE' });
}

export interface ReplyData {
  comment: string;
  nick?: string;
  mail?: string;
  link?: string;
  url?: string;
  ua?: string;
  pid?: string | number;
  rid?: string | number;
  at?: string;
}

/** POST /api/comment —— 以当前登录用户身份发表回复 */
export function replyComment(data: ReplyData): Promise<Comment> {
  return request<Comment>('/comment', { method: 'POST', body: data });
}
