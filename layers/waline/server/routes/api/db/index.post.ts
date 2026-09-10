import { insertResponse } from '../../../waline/services/db-admin';
import { walineHandler } from '../../../waline/context';

/** POST /api/db?table=Comment|Users —— 插入一行 */
export default walineHandler(async (event) => {
  const body = await readBody(event);
  return insertResponse(event, body ?? {});
});
