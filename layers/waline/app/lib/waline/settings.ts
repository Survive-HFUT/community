import { request } from './client';
import type { Settings } from './types';

/** GET /api/settings —— 读取设置（服务端只返回白名单内的键） */
export async function getSettings(): Promise<Settings> {
  return (await request<Settings>('/settings')) || {};
}

/** PUT /api/settings —— 批量写入（服务端只接受白名单键） */
export function updateSettings(data: Partial<Settings>): Promise<unknown> {
  return request('/settings', { method: 'PUT', body: data });
}
