import { loginResponse } from '../../../waline/services/tokens';
import { walineHandler } from '../../../waline/context';

/** POST /api/token —— 登录，签发 JWT 并种下 httpOnly TOKEN Cookie */
export default walineHandler(async (event) => {
  const body = await readBody(event);
  return loginResponse(event, body ?? {});
});
