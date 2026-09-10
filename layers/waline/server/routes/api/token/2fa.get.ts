import { twoFactorStatusResponse } from '../../../waline/services/tokens';
import { walineHandler } from '../../../waline/context';

/**
 * GET /api/token/2fa
 *   未登录 + ?email=：公开查询该邮箱是否开启两步验证
 *   已登录：返回 otpauth_url + secret
 */
export default walineHandler((event) => twoFactorStatusResponse(event));
