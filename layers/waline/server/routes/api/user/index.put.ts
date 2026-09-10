import { updateUserResponse } from '../../../waline/services/users';
import { requireUser, walineHandler } from '../../../waline/context';

/**
 * PUT /api/user —— 更新当前登录用户的资料。
 * 目标用户始终由已验证的 token 决定，绝不从请求体里取 id。
 */
export default walineHandler(async (event) => {
  const user = requireUser(event);
  const body = await readBody(event);
  return updateUserResponse(event, String(user.objectId), body ?? {}, user);
});
