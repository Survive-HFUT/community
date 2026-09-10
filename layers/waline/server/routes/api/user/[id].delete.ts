import { deleteUserResponse } from '../../../waline/services/users';
import { walineHandler } from '../../../waline/context';

/** DELETE /api/user/:id —— 删除未验证用户 / 封禁已验证用户（仅管理员） */
export default walineHandler((event) => {
  const id = getRouterParam(event, 'id') ?? '';
  return deleteUserResponse(event, id);
});
