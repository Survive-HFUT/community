/**
 * 数据导入 / 导出 —— 兼容 @waline/admin 的「迁移」面板。
 * 从上游 `server/router/waline/db.ts` 平移。
 *
 *   GET    /api/db                         导出全部数据
 *   POST   /api/db?table=Comment           插入一行
 *   PUT    /api/db?table=Comment&objectId=1 更新一行
 *   DELETE /api/db?table=Comment           清空一张表
 *
 */
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../database/client';
import {
  comments,
  users,
  type CommentInsert,
  type UserInsert,
} from '../../database/schema';
import {
  getWalineEnv,
  queryString,
  requireAdmin,
  walineFail,
} from '../context';

type Envelope = Record<string, unknown>;

/** 允许导入/导出的「逻辑表」 */
const EXPORT_TABLES = ['Comment', 'Users'] as const;
type LogicalTable = (typeof EXPORT_TABLES)[number];

function isLogicalTable(value: string): value is LogicalTable {
  return value === 'Comment' || value === 'Users';
}

/**
 * 每张表允许写入的列：逻辑列名 → Drizzle 列对象。
 * 白名单同时承担两个作用：过滤未知字段、保证不会有动态列名被拼进 SQL。
 */
const COLUMNS = {
  Comment: {
    user_id: comments.user_id,
    comment: comments.comment,
    orig: comments.orig,
    insertedAt: comments.insertedAt,
    ip: comments.ip,
    link: comments.link,
    mail: comments.mail,
    nick: comments.nick,
    pid: comments.pid,
    rid: comments.rid,
    sticky: comments.sticky,
    status: comments.status,
    like: comments.like,
    ua: comments.ua,
    url: comments.url,
    createdAt: comments.createdAt,
    updatedAt: comments.updatedAt,
  },
  Users: {
    display_name: users.display_name,
    email: users.email,
    password: users.password,
    type: users.type,
    label: users.label,
    url: users.url,
    avatar: users.avatar,
    github: users.github,
    twitter: users.twitter,
    facebook: users.facebook,
    google: users.google,
    weibo: users.weibo,
    qq: users.qq,
    '2fa': users['2fa'],
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
  },
} as const;

/** 从请求体里挑出白名单内、且值非空的列 */
function pickColumns(
  table: LogicalTable,
  payload: Record<string, unknown>,
  skip: string[] = [],
): Record<string, unknown> {
  const allowed = COLUMNS[table] as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (skip.includes(key)) continue;
    if (!(key in allowed)) continue;
    if (value === null || value === undefined) continue;
    picked[key] = value;
  }
  return picked;
}

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
  const db = getDb(env.DB);

  // D1 的 id → Waline 的 objectId
  data.Comment = (await db.select().from(comments)).map((row) => ({
    ...row,
    objectId: String(row.id),
  }));
  data.Users = (await db.select().from(users)).map((row) => ({
    ...row,
    objectId: String(row.id),
  }));

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
  if (!table || !isLogicalTable(table))
    return walineFail(event, 'Invalid table', 400);

  const payload = { ...body };
  delete payload.objectId;
  delete payload.id;

  const values = pickColumns(table, payload);
  if (Object.keys(values).length === 0)
    return walineFail(event, 'Empty data', 400);

  const db = getDb(env.DB);

  if (table === 'Comment') {
    const [row] = await db
      .insert(comments)
      .values(values as unknown as CommentInsert)
      .returning({ id: comments.id });
    return { errno: 0, data: { objectId: String(row.id) } };
  }

  const [row] = await db
    .insert(users)
    .values(values as unknown as UserInsert)
    .returning({ id: users.id });
  return { errno: 0, data: { objectId: String(row.id) } };
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
  if (!table || !isLogicalTable(table) || !objectId) {
    return walineFail(event, 'Invalid table or objectId', 400);
  }

  const payload = { ...body };
  delete payload.objectId;
  delete payload.id;
  delete payload.createdAt;

  // updatedAt 统一由下面的 SET 写成当前时间，这里先剔除以免重复赋值
  const values = pickColumns(table, payload, ['updatedAt']);
  if (Object.keys(values).length === 0) return { errno: 0 };

  const db = getDb(env.DB);
  const id = Number(objectId);

  if (table === 'Comment') {
    await db
      .update(comments)
      .set({
        ...values,
        updatedAt: sql`(datetime('now'))`,
      } as unknown as Partial<CommentInsert>)
      .where(eq(comments.id, id));
  } else {
    await db
      .update(users)
      .set({
        ...values,
        updatedAt: sql`(datetime('now'))`,
      } as unknown as Partial<UserInsert>)
      .where(eq(users.id, id));
  }

  return { errno: 0 };
}

/** DELETE /api/db?table=Comment —— 清空一张表 */
export async function clearTableResponse(event: H3Event): Promise<Envelope> {
  const env = getWalineEnv(event);
  requireAdmin(event);

  const table = queryString(event, 'table');
  if (!table || !isLogicalTable(table))
    return walineFail(event, 'Invalid table', 400);

  const db = getDb(env.DB);
  if (table === 'Comment') await db.delete(comments);
  else await db.delete(users);

  return { errno: 0 };
}
