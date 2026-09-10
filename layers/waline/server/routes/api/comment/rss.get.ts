import { commentRssResponse } from '../../../waline/services/comments';
import { walineHandler } from '../../../waline/context';

/**
 * GET /api/comment/rss —— 评论 RSS
 *   ?path=     按页面过滤
 *   ?email= / ?user_id=  我收到的回复
 *   ?count=    条数（默认 20，上限 50）
 */
export default walineHandler((event) => commentRssResponse(event));
