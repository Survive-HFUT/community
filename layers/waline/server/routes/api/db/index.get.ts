import { exportResponse } from '../../../waline/services/db-admin';
import { walineHandler } from '../../../waline/context';

/** GET /api/db —— 导出 wl_Comment / wl_Users（仅管理员，兼容 @waline/admin 迁移面板） */
export default walineHandler((event) => exportResponse(event));
