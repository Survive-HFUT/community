import { updateUserResponse } from '../../../waline/services/users';
import {
  requireUser,
  walineFail,
  walineHandler,
} from '../../../waline/context';

/**
 * PUT /api/user/:id —— 更新指定用户。
 * 管理员可改他人，普通用户只能改自己。
 */
export default walineHandler(async (event) => {
  const user = requireUser(event);
  const id = getRouterParam(event, 'id') ?? '';

  const isAdmin = user.type === 'administrator';
  const isSelf = user.objectId === Number(id);
  if (!isAdmin && !isSelf) return walineFail(event, 'Forbidden', 403);

  const body = await readBody(event);
  return updateUserResponse(event, id, body ?? {}, user);
});
