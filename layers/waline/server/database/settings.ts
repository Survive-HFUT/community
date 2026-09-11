/**
 * 站点设置数据访问层 —— `wl_Settings` 的唯一出口（Drizzle 实现）。
 */
import { eq, inArray, sql } from 'drizzle-orm';
import { getDb } from './client';
import { settings } from './schema';

/** 读取单个设置项 */
export async function getSetting(
  d1: D1Database,
  key: string,
): Promise<string | null> {
  const db = getDb(d1);
  const row = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .get();
  return row?.value ?? null;
}

/** 批量读取设置项（未设置的 key 不返回） */
export async function getSettings(
  d1: D1Database,
  keys: string[],
): Promise<Record<string, string>> {
  if (keys.length === 0) return {};

  const db = getDb(d1);
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(inArray(settings.key, keys));

  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

/** 读取全部设置项（管理后台导出用） */
export async function listAllSettings(
  d1: D1Database,
): Promise<Array<{ key: string; value: string }>> {
  const db = getDb(d1);
  return db.select({ key: settings.key, value: settings.value }).from(settings);
}

/** 批量写入设置项（upsert，单条语句提交） */
export async function setSettings(
  d1: D1Database,
  entries: Record<string, string>,
): Promise<void> {
  const rows = Object.entries(entries).map(([key, value]) => ({ key, value }));
  if (rows.length === 0) return;

  const db = getDb(d1);
  await db
    .insert(settings)
    .values(rows)
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: sql`excluded.value`,
        updatedAt: sql`(datetime('now'))`,
      },
    });
}
