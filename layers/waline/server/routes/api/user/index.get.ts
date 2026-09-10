import { userListResponse } from '../../../waline/services/users';
import { walineHandler } from '../../../waline/context';

/**
 * GET /api/user
 *   公开：评论数排行（?count=）
 *   管理员：分页列表（?page=&pageSize=）或 ?email= 精确查用户
 */
export default walineHandler((event) => userListResponse(event));
