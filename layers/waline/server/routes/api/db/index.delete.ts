import { clearTableResponse } from '../../../waline/services/db-admin';
import { walineHandler } from '../../../waline/context';

/** DELETE /api/db?table=Comment|Users —— 清空一张表 */
export default walineHandler((event) => clearTableResponse(event));
