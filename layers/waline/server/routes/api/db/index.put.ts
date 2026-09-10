import { updateRowResponse } from '../../../waline/services/db-admin';
import { walineHandler } from '../../../waline/context';

/** PUT /api/db?table=Comment|Users&objectId=1 —— 更新一行 */
export default walineHandler(async (event) => {
  const body = await readBody(event);
  return updateRowResponse(event, body ?? {});
});
