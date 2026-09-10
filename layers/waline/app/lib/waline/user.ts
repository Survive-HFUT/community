import { request } from './client';
import type { AdminUser, UserListResp } from './types';

/** GET /api/user —— 管理端分页用户列表 */
export function getUserList(page = 1, pageSize = 20): Promise<UserListResp> {
  return request<UserListResp>('/user', { query: { page, pageSize } });
}

/** PUT /api/user/:id —— 更新指定用户（管理员可改 type） */
export function updateUser(
  id: string | number,
  data: Record<string, unknown>,
): Promise<AdminUser> {
  return request<AdminUser>(`/user/${id}`, { method: 'PUT', body: data });
}

/** PUT /api/user —— 更新当前登录用户的资料 */
export function updateProfile(
  data: Record<string, unknown>,
): Promise<AdminUser> {
  return request<AdminUser>('/user', { method: 'PUT', body: data });
}

/** DELETE /api/user/:id —— 删除（未验证/guest）或封禁（已验证） */
export function deleteUser(id: string | number): Promise<unknown> {
  return request(`/user/${id}`, { method: 'DELETE' });
}
