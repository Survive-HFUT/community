import { getSettingsResponse } from '../../../waline/services/settings';
import { walineHandler } from '../../../waline/context';

/** GET /api/settings —— 读取全部设置（仅管理员，敏感值已打码） */
export default walineHandler((event) => getSettingsResponse(event));
