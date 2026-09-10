import { updateSettingsResponse } from '../../../waline/services/settings';
import { walineHandler } from '../../../waline/context';

/** PUT /api/settings —— 批量写入设置（仅管理员，只接受白名单键） */
export default walineHandler(async (event) => {
  const body = await readBody(event);
  return updateSettingsResponse(event, body ?? {});
});
