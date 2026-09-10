import { enableTwoFactorResponse } from '../../../waline/services/tokens';
import { walineHandler } from '../../../waline/context';

/** POST /api/token/2fa —— 校验验证码并启用两步验证 */
export default walineHandler(async (event) => {
  const body = await readBody(event);
  return enableTwoFactorResponse(event, body ?? {});
});
