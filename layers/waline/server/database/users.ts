import { and, count, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { getDb } from './client';
import {
  comments,
  USER_SOCIAL_COLUMNS,
  users,
  type UserInsert,
  type UserSocialField,
} from './schema';

/**
 * 用户数据访问层 —— 所有 wl_Users 相关查询的唯一出口（Drizzle 实现）。
 * 业务代码通过 createUser / getUserById 等函数访问数据库，不再直接写 SQL。
 */

/** auth 中间件/用户资料常用的列（含通知偏好列） */
const USER_AUTH_COLUMNS = {
  id: users.id,
  display_name: users.display_name,
  email: users.email,
  type: users.type,
  url: users.url,
  avatar: users.avatar,
  label: users.label,
  github: users.github,
  twitter: users.twitter,
  facebook: users.facebook,
  google: users.google,
  weibo: users.weibo,
  qq: users.qq,
  '2fa': users['2fa'],
  notify_admin_comment: users.notify_admin_comment,
  notify_reply: users.notify_reply,
} as const;

export interface CreateUserData {
  display_name?: string;
  email: string;
  password: string;
  type: string;
  url?: string;
  avatar?: string;
  /** 社交登录创建时绑定的社交字段（如 github/qq），缺省 github */
  socialField?: string;
  socialId?: string;
}

/**
 * 把（可能来自调用方的）社交字段名解析成受控的列名。
 * 不在白名单里的字段一律回退到 github —— 这样动态列名永远不会拼进 SQL。
 */
function resolveSocialField(field: string | undefined): UserSocialField {
  const key = (field || 'github') as UserSocialField;
  return key in USER_SOCIAL_COLUMNS ? key : 'github';
}

/** 按 id 取用户（auth 中间件 / 注册后回读 / 通知收件人解析用） */
export async function getUserById(
  d1: D1Database,
  id: number,
): Promise<any | null> {
  const db = getDb(d1);
  const row = await db
    .select(USER_AUTH_COLUMNS)
    .from(users)
    .where(eq(users.id, id))
    .get();
  return row ?? null;
}

/** 登录用：按邮箱取完整行（含 password / 2fa） */
export async function getUserAuthByEmail(
  d1: D1Database,
  email: string,
): Promise<any | null> {
  const db = getDb(d1);
  const row = await db.select().from(users).where(eq(users.email, email)).get();
  return row ?? null;
}

/** 按邮箱查 id（注册查重） */
export async function getUserByEmail(
  d1: D1Database,
  email: string,
): Promise<{ id: number } | null> {
  const db = getDb(d1);
  const row = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .get();
  return row ?? null;
}

/** 管理员按邮箱查用户（导入流程用，不暴露敏感列） */
export async function getAdminUserByEmail(
  d1: D1Database,
  email: string,
): Promise<{
  id: number;
  display_name: string;
  email: string;
  type: string;
} | null> {
  const db = getDb(d1);
  const row = await db
    .select({
      id: users.id,
      display_name: users.display_name,
      email: users.email,
      type: users.type,
    })
    .from(users)
    .where(eq(users.email, email))
    .get();
  return row ?? null;
}

/**
 * 按社交字段（github/qq 等）查用户。
 * 字段名统一经 `resolveSocialField` 收敛到白名单（非法值回退 github），
 * 因此不存在把请求参数直接拼进 SQL 的风险。
 */
export async function getUserBySocial(
  d1: D1Database,
  socialField: string,
  socialId: string,
): Promise<any | null> {
  const db = getDb(d1);
  const column = USER_SOCIAL_COLUMNS[resolveSocialField(socialField)];
  const row = await db.select().from(users).where(eq(column, socialId)).get();
  return row ?? null;
}

/** 检查某社交 id 是否已绑定到其它账号（返回冲突行的 id） */
export async function getSocialConflict(
  d1: D1Database,
  socialField: string,
  socialId: string,
  excludeId: number,
): Promise<{ id: number } | null> {
  const db = getDb(d1);
  const column = USER_SOCIAL_COLUMNS[resolveSocialField(socialField)];
  const row = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(column, socialId), ne(users.id, excludeId)))
    .get();
  return row ?? null;
}

/** 给用户绑定社交账号 */
export async function bindSocial(
  d1: D1Database,
  userId: number,
  socialField: string,
  socialId: string,
): Promise<void> {
  const db = getDb(d1);
  const field = resolveSocialField(socialField);
  await db
    .update(users)
    .set({
      [field]: socialId,
      updatedAt: sql`(datetime('now'))`,
    } as unknown as Partial<UserInsert>)
    .where(eq(users.id, userId));
}

/** 用户总数（注册判首个管理员） */
export async function countUsers(d1: D1Database): Promise<number> {
  const db = getDb(d1);
  const [row] = await db.select({ count: count() }).from(users);
  return row?.count ?? 0;
}

/** 管理员分页用户列表 */
export async function listUsers(
  d1: D1Database,
  pageSize: number,
  offset: number,
): Promise<any[]> {
  const db = getDb(d1);
  return db
    .select({
      id: users.id,
      display_name: users.display_name,
      email: users.email,
      type: users.type,
      url: users.url,
      avatar: users.avatar,
      label: users.label,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset(offset);
}

/** 公开：评论数排行用户 */
export async function getTopCommenters(
  d1: D1Database,
  limit: number,
): Promise<any[]> {
  const db = getDb(d1);
  return db
    .select({
      id: users.id,
      display_name: users.display_name,
      url: users.url,
      avatar: users.avatar,
      label: users.label,
      comment_count: count(comments.id),
    })
    .from(users)
    .leftJoin(
      comments,
      and(eq(comments.user_id, users.id), eq(comments.status, 'approved')),
    )
    .groupBy(users.id)
    .orderBy(desc(count(comments.id)))
    .limit(limit);
}

/** 创建用户，返回新用户 id（社交登录可顺带绑定社交字段） */
export async function createUser(
  d1: D1Database,
  data: CreateUserData,
): Promise<number> {
  const db = getDb(d1);
  const field = resolveSocialField(data.socialField);

  const values = {
    display_name: data.display_name || data.email.split('@')[0],
    email: data.email,
    password: data.password,
    type: data.type,
    url: data.url || '',
    avatar: data.avatar || '',
    [field]: data.socialId || '',
  } as unknown as UserInsert;

  const [row] = await db
    .insert(users)
    .values(values)
    .returning({ id: users.id });
  return row!.id;
}

/**
 * 按白名单更新用户字段。
 * 调用方只需给出「想改的字段」，列名由下面的白名单收敛，
 * 非法字段名会被直接忽略，不会被拼接进 SQL。
 */
export async function updateUserFields(
  d1: D1Database,
  id: string | number,
  updates: Record<string, unknown>,
): Promise<void> {
  const COLUMNS = {
    display_name: users.display_name,
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
    notify_admin_comment: users.notify_admin_comment,
    notify_reply: users.notify_reply,
  } as const;

  const set: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(updates)) {
    if (field in COLUMNS) set[field] = value;
  }
  if (Object.keys(set).length === 0) return;

  const db = getDb(d1);
  await db
    .update(users)
    .set({
      ...set,
      updatedAt: sql`(datetime('now'))`,
    } as unknown as Partial<UserInsert>)
    .where(eq(users.id, Number(id)));
}

/** 删除用户（未验证/guest 硬删） */
export async function deleteUser(d1: D1Database, id: number): Promise<void> {
  const db = getDb(d1);
  await db.delete(users).where(eq(users.id, id));
}

/** 封禁用户 */
export async function banUser(d1: D1Database, id: number): Promise<void> {
  const db = getDb(d1);
  await db
    .update(users)
    .set({ type: 'banned', updatedAt: sql`(datetime('now'))` })
    .where(eq(users.id, id));
}

/** 查用户类型（删除/封禁判定用） */
export async function getUserType(
  d1: D1Database,
  id: number,
): Promise<{ type: string } | null> {
  const db = getDb(d1);
  const row = await db
    .select({ type: users.type })
    .from(users)
    .where(eq(users.id, id))
    .get();
  return row ?? null;
}

/** 邮件通知：所有开启「收到新评论通知」且绑定了邮箱的管理员 */
export async function getAdminsForNotify(
  d1: D1Database,
): Promise<Array<{ id: number; display_name: string; email: string }>> {
  const db = getDb(d1);
  return db
    .select({
      id: users.id,
      display_name: users.display_name,
      email: users.email,
    })
    .from(users)
    .where(
      and(
        eq(users.type, 'administrator'),
        ne(users.email, ''),
        eq(users.notify_admin_comment, 1),
      ),
    );
}

/** 批量取用户（评论列表等避免 N+1 查询） */
export async function getUsersByIds(
  d1: D1Database,
  ids: number[],
): Promise<any[]> {
  if (ids.length === 0) return [];
  const db = getDb(d1);
  return db
    .select({
      id: users.id,
      display_name: users.display_name,
      email: users.email,
      type: users.type,
      url: users.url,
      avatar: users.avatar,
      label: users.label,
      notify_admin_comment: users.notify_admin_comment,
      notify_reply: users.notify_reply,
    })
    .from(users)
    .where(inArray(users.id, ids));
}

/** 公开 2FA 检查：按邮箱查是否启用（只取 2fa 列） */
export async function getUser2faByEmail(
  d1: D1Database,
  email: string,
): Promise<{ '2fa': string } | null> {
  const db = getDb(d1);
  const row = await db
    .select({ '2fa': users['2fa'] })
    .from(users)
    .where(eq(users.email, email))
    .get();
  return row ? { '2fa': row['2fa'] ?? '' } : null;
}

/** 启用/更新 2FA secret */
export async function setUser2fa(
  d1: D1Database,
  userId: number,
  secret: string,
): Promise<void> {
  const db = getDb(d1);
  await db.update(users).set({ '2fa': secret }).where(eq(users.id, userId));
}
