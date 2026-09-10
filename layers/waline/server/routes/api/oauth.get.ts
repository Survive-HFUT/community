import { oauthResponse } from '../../waline/services/oauth';
import { walineHandler } from '../../waline/context';

/**
 * GET /api/oauth —— 社交登录 / 账号绑定。
 *   无 code：302 到 OAuth 网关
 *   有 code：换取用户信息 → 建号/绑定 → 302 回前端并带 ?token=
 */
export default walineHandler((event) => oauthResponse(event));
