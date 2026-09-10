import { registerResponse } from '../../../waline/services/users';
import { walineHandler } from '../../../waline/context';

/** POST /api/user —— 注册（首个账号自动成为管理员） */
export default walineHandler(async (event) => {
  const body = await readBody(event);
  return registerResponse(event, body ?? {});
});
