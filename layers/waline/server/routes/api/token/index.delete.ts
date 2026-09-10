import { logoutResponse } from '../../../waline/services/tokens';
import { walineHandler } from '../../../waline/context';

/** DELETE /api/token —— 退出登录（清除 TOKEN Cookie） */
export default walineHandler((event) => logoutResponse(event));
