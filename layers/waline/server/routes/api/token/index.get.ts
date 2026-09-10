import { currentUserResponse } from '../../../waline/services/tokens';
import { walineHandler } from '../../../waline/context';

/** GET /api/token —— 当前登录用户信息 */
export default walineHandler((event) => currentUserResponse(event));
