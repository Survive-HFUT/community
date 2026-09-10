/**
 * 站点设置 —— 从上游 `server/router/waline/settings.ts` 平移。
 */
import { listAllSettings, setSettings } from '../../database/index';
import { getWalineEnv, requireAdmin, walineOk } from '../context';

type Envelope = Record<string, unknown>;

const ALLOWED_KEYS = new Set([
  'waline_client_version',
  'waline_admin_version',
  'comment_default_status',
  'user_comment_default_status',
]);

/** GET /api/settings —— 读取设置（仅管理员） */
export async function getSettingsResponse(event: H3Event): Promise<Envelope> {
  const env = getWalineEnv(event);
  requireAdmin(event);

  const rows = await listAllSettings(env.DB);

  const settings: Record<string, string> = {};
  for (const row of rows) {
    // 只回传白名单内的键：库里可能残留历史键（例如已废弃的 akismet_key），
    // 不认识的键一律不外泄。
    if (!ALLOWED_KEYS.has(row.key)) continue;
    settings[row.key] = row.value;
  }

  return { errno: 0, errmsg: '', data: settings };
}

/** PUT /api/settings —— 批量写入设置（仅管理员） */
export async function updateSettingsResponse(
  event: H3Event,
  body: Record<string, unknown>,
): Promise<Envelope> {
  const env = getWalineEnv(event);
  requireAdmin(event);

  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    entries[key] = String(value);
  }

  await setSettings(env.DB, entries);
  return walineOk();
}
