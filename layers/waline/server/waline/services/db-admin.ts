/**
 * 数据导入 / 导出 —— 兼容 @waline/admin 的「迁移」面板。
 * 从上游 `server/router/waline/db.ts` 平移。
 *
 *   GET    /api/db                         导出全部数据
 *   POST   /api/db?table=Comment           插入一行
 *   PUT    /api/db?table=Comment&objectId=1 更新一行
 *   DELETE /api/db?table=Comment           清空一张表
 *
 * 已按需求移除流量统计，因此不再包含 Counter 表。
 */
import {
  getWalineEnv,
  queryString,
  requireAdmin,
  walineFail,
} from '../context';

type Envelope = Record<string, unknown>;

/** Waline 逻辑表名 → D1 实际表名 */
const TABLE_MAP: Record<string, string> = {
  Comment: 'wl_Comment',
  Users: 'wl_Users',
};

/** 每张表允许写入的列（防止通过动态列名注入 SQL） */
const ALLOWED_COLUMNS: Record<string, Set<string>> = {
  Comment: new Set([
    'user_id',
    'comment',
    'orig',
    'insertedAt',
    'ip',
    'link',
    'mail',
    'nick',
    'pid',
    'rid',
    'sticky',
    'status',
    'like',
    'ua',
    'url',
    'createdAt',
    'updatedAt',
  ]),
  Users: new Set([
    'display_name',
    'email',
    'password',
    'type',
    'label',
    'url',
    'avatar',
    'github',
    'twitter',
    'facebook',
    'google',
    'weibo',
    'qq',
    '2fa',
    'createdAt',
    'updatedAt',
  ]),
};

const EXPORT_TABLES = ['Comment', 'Users'];

/** GET /api/db —— 导出（@waline/admin 会取 `{ __version, ...data }`） */
export async function exportResponse(event: H3Event): Promise<Envelope> {
  const env = getWalineEnv(event);
  requireAdmin(event);

  const exportData: Record<string, unknown> = {
    type: 'waline',
    version: 1,
    time: Date.now(),
    tables: EXPORT_TABLES,
    data: {
      Comment: [] as unknown[],
      Users: [] as unknown[],
    },
  };

  const data = exportData.data as Record<string, unknown[]>;
  for (const logicalName of EXPORT_TABLES) {
    const tableName = TABLE_MAP[logicalName];
    const { results } = await env.DB.prepare(
      `SELECT * FROM "${tableName}"`,
    ).all();
    // D1 的 id → Waline 的 objectId
    data[logicalName] = (results || []).map((row: any) => ({
      ...row,
      objectId: String(row.id),
    }));
  }

  return { errno: 0, data: exportData };
}

/** POST /api/db?table=Comment —— 插入一行，需返回 objectId 供前端建立 id 映射 */
export async function insertResponse(
  event: H3Event,
  body: Record<string, unknown>,
): Promise<Envelope> {
  const env = getWalineEnv(event);
  requireAdmin(event);

  const table = queryString(event, 'table');
  if (!table || !TABLE_MAP[table])
    return walineFail(event, 'Invalid table', 400);

  const tableName = TABLE_MAP[table];
  const allowedCols = ALLOWED_COLUMNS[table];

  const payload = { ...body };
  delete payload.objectId;
  delete payload.id;

  const keys = Object.keys(payload).filter(
    (k) =>
      allowedCols.has(k) && payload[k] !== null && payload[k] !== undefined,
  );
  if (keys.length === 0) return walineFail(event, 'Empty data', 400);

  const cols = keys.map((k) => `"${k}"`).join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  const values = keys.map((k) => payload[k]);

  const result = await env.DB.prepare(
    `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders})`,
  )
    .bind(...values)
    .run();

  if (!result.success) return walineFail(event, 'Insert failed', 500);

  const row = await env.DB.prepare(
    `SELECT id FROM "${tableName}" WHERE rowid = last_insert_rowid()`,
  ).first();

  return {
    errno: 0,
    data: { objectId: row ? String((row as any).id) : null },
  };
}

/** PUT /api/db?table=Comment&objectId=1 —— 更新一行 */
export async function updateRowResponse(
  event: H3Event,
  body: Record<string, unknown>,
): Promise<Envelope> {
  const env = getWalineEnv(event);
  requireAdmin(event);

  const table = queryString(event, 'table');
  const objectId = queryString(event, 'objectId');
  if (!table || !TABLE_MAP[table] || !objectId) {
    return walineFail(event, 'Invalid table or objectId', 400);
  }

  const tableName = TABLE_MAP[table];
  const allowedCols = ALLOWED_COLUMNS[table];

  const payload = { ...body };
  delete payload.objectId;
  delete payload.id;
  delete payload.createdAt;

  const keys = Object.keys(payload).filter(
    (k) =>
      allowedCols.has(k) && payload[k] !== null && payload[k] !== undefined,
  );
  if (keys.length === 0) return { errno: 0 };

  const setClauses = keys.map((k) => `"${k}" = ?`).join(', ');
  const values = keys.map((k) => payload[k]);

  await env.DB.prepare(
    `UPDATE "${tableName}" SET ${setClauses}, "updatedAt" = datetime('now') WHERE id = ?`,
  )
    .bind(...values, Number(objectId))
    .run();

  return { errno: 0 };
}

/** DELETE /api/db?table=Comment —— 清空一张表 */
export async function clearTableResponse(event: H3Event): Promise<Envelope> {
  const env = getWalineEnv(event);
  requireAdmin(event);

  const table = queryString(event, 'table');
  if (!table || !TABLE_MAP[table])
    return walineFail(event, 'Invalid table', 400);

  await env.DB.prepare(`DELETE FROM "${TABLE_MAP[table]}"`).run();
  return { errno: 0 };
}
