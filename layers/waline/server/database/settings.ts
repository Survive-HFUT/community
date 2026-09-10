/**
 * 站点设置数据访问层 —— wl_Settings 相关 SQL 的唯一出口。
 */

/** 读取单个设置项 */
export async function getSetting(
  db: D1Database,
  key: string,
): Promise<string | null> {
  const row = await db
    .prepare('SELECT value FROM wl_Settings WHERE key = ?')
    .bind(key)
    .first();
  return row ? (row.value as string) : null;
}

/** 批量读取设置项（未设置的 key 不返回） */
export async function getSettings(
  db: D1Database,
  keys: string[],
): Promise<Record<string, string>> {
  const placeholders = keys.map(() => '?').join(',');
  const result = await db
    .prepare(
      `SELECT key, value FROM wl_Settings WHERE key IN (${placeholders})`,
    )
    .bind(...keys)
    .all();

  const settings: Record<string, string> = {};
  for (const row of result.results) {
    settings[row.key as string] = row.value as string;
  }
  return settings;
}

/** 读取全部设置项（管理后台导出用） */
export async function listAllSettings(
  db: D1Database,
): Promise<Array<{ key: string; value: string }>> {
  const result = await db
    .prepare('SELECT key, value FROM wl_Settings')
    .all<{ key: string; value: string }>();
  return result.results;
}

/** 批量写入设置项（upsert，单次 batch 提交） */
export async function setSettings(
  db: D1Database,
  entries: Record<string, string>,
): Promise<void> {
  const stmts: D1PreparedStatement[] = Object.entries(entries).map(
    ([key, value]) =>
      db
        .prepare(
          `INSERT INTO wl_Settings (key, value, updatedAt) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
        )
        .bind(key, value),
  );
  if (stmts.length > 0) {
    await db.batch(stmts);
  }
}
