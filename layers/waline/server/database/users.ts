/**
 * 用户数据访问层 —— 所有 wl_Users 相关 SQL 的唯一出口。
 * 业务代码通过 createUser / getUserById 等函数访问数据库，不再直接写 SQL。
 */

/** auth 中间件/用户资料常用的列（含通知偏好列） */
const USER_AUTH_COLUMNS = `id, display_name, email, type, url, avatar, label,
  github, twitter, facebook, google, weibo, qq, "2fa",
  notify_admin_comment, notify_reply`;

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

/** 按 id 取用户（auth 中间件 / 注册后回读 / 通知收件人解析用） */
export async function getUserById(
  db: D1Database,
  id: number,
): Promise<any | null> {
  return db
    .prepare(`SELECT ${USER_AUTH_COLUMNS} FROM wl_Users WHERE id = ?`)
    .bind(id)
    .first();
}

/** 登录用：按邮箱取完整行（含 password / 2fa） */
export async function getUserAuthByEmail(
  db: D1Database,
  email: string,
): Promise<any | null> {
  return db
    .prepare('SELECT * FROM wl_Users WHERE email = ?')
    .bind(email)
    .first();
}

/** 按邮箱查 id（注册查重） */
export async function getUserByEmail(
  db: D1Database,
  email: string,
): Promise<{ id: number } | null> {
  return db
    .prepare('SELECT id FROM wl_Users WHERE email = ?')
    .bind(email)
    .first<{ id: number }>();
}

/** 管理员按邮箱查用户（导入流程用，不暴露敏感列） */
export async function getAdminUserByEmail(
  db: D1Database,
  email: string,
): Promise<{
  id: number;
  display_name: string;
  email: string;
  type: string;
} | null> {
  return db
    .prepare(
      'SELECT id, display_name, email, type FROM wl_Users WHERE email = ?',
    )
    .bind(email)
    .first<{ id: number; display_name: string; email: string; type: string }>();
}

/**
 * 按社交字段（github/qq 等）查用户。
 * ⚠️ socialField 必须来自调用方的白名单，不能直接使用请求参数。
 */
export async function getUserBySocial(
  db: D1Database,
  socialField: string,
  socialId: string,
): Promise<any | null> {
  return db
    .prepare(`SELECT * FROM wl_Users WHERE ${socialField} = ?`)
    .bind(socialId)
    .first();
}

/** 检查某社交 id 是否已绑定到其它账号（返回冲突行的 id） */
export async function getSocialConflict(
  db: D1Database,
  socialField: string,
  socialId: string,
  excludeId: number,
): Promise<{ id: number } | null> {
  return db
    .prepare(`SELECT id FROM wl_Users WHERE ${socialField} = ? AND id != ?`)
    .bind(socialId, excludeId)
    .first<{ id: number }>();
}

/** 给用户绑定社交账号 */
export async function bindSocial(
  db: D1Database,
  userId: number,
  socialField: string,
  socialId: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE wl_Users SET ${socialField} = ?, updatedAt = datetime('now') WHERE id = ?`,
    )
    .bind(socialId, userId)
    .run();
}

/** 用户总数（注册判首个管理员） */
export async function countUsers(db: D1Database): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) as count FROM wl_Users')
    .first<{ count: number }>();
  return row?.count ?? 0;
}

/** 管理员分页用户列表 */
export async function listUsers(
  db: D1Database,
  pageSize: number,
  offset: number,
): Promise<any[]> {
  const result = await db
    .prepare(
      'SELECT id, display_name, email, type, url, avatar, label, createdAt FROM wl_Users ORDER BY createdAt DESC LIMIT ? OFFSET ?',
    )
    .bind(pageSize, offset)
    .all();
  return result.results;
}

/** 公开：评论数排行用户 */
export async function getTopCommenters(
  db: D1Database,
  count: number,
): Promise<any[]> {
  const result = await db
    .prepare(
      `SELECT u.id, u.display_name, u.url, u.avatar, u.label,
              COUNT(c.id) as comment_count
       FROM wl_Users u
       LEFT JOIN wl_Comment c ON c.user_id = u.id AND c.status = 'approved'
       GROUP BY u.id
       ORDER BY comment_count DESC
       LIMIT ?`,
    )
    .bind(count)
    .all();
  return result.results;
}

/** 创建用户，返回新用户 id（社交登录可顺带绑定社交字段） */
export async function createUser(
  db: D1Database,
  data: CreateUserData,
): Promise<number> {
  const socialField = data.socialField || 'github';
  const result = await db
    .prepare(
      `INSERT INTO wl_Users (display_name, email, password, type, url, avatar, ${socialField})
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      data.display_name || data.email.split('@')[0],
      data.email,
      data.password,
      data.type,
      data.url || '',
      data.avatar || '',
      data.socialId || '',
    )
    .run();
  return Number(result.meta.last_row_id);
}

/**
 * 按白名单更新用户字段。
 * 调用方负责校验字段名（allowedFields），这里只做拼接。
 */
export async function updateUserFields(
  db: D1Database,
  id: string | number,
  updates: Record<string, unknown>,
): Promise<void> {
  const fields = Object.keys(updates);
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `"${f}" = ?`).join(', ');
  await db
    .prepare(
      `UPDATE wl_Users SET ${setClauses}, updatedAt = datetime('now') WHERE id = ?`,
    )
    .bind(...fields.map((f) => updates[f]), id)
    .run();
}

/** 删除用户（未验证/guest 硬删） */
export async function deleteUser(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM wl_Users WHERE id = ?').bind(id).run();
}

/** 封禁用户 */
export async function banUser(db: D1Database, id: number): Promise<void> {
  await db
    .prepare(
      "UPDATE wl_Users SET type = 'banned', updatedAt = datetime('now') WHERE id = ?",
    )
    .bind(id)
    .run();
}

/** 查用户类型（删除/封禁判定用） */
export async function getUserType(
  db: D1Database,
  id: number,
): Promise<{ type: string } | null> {
  return db
    .prepare('SELECT type FROM wl_Users WHERE id = ?')
    .bind(id)
    .first<{ type: string }>();
}

/** 邮件通知：所有开启「收到新评论通知」且绑定了邮箱的管理员 */
export async function getAdminsForNotify(
  db: D1Database,
): Promise<Array<{ id: number; display_name: string; email: string }>> {
  const result = await db
    .prepare(
      `SELECT id, display_name, email FROM wl_Users
       WHERE type = 'administrator' AND email <> '' AND notify_admin_comment = 1`,
    )
    .all();
  return result.results as Array<{
    id: number;
    display_name: string;
    email: string;
  }>;
}

/** 批量取用户（评论列表等避免 N+1 查询） */
export async function getUsersByIds(
  db: D1Database,
  ids: number[],
): Promise<any[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const result = await db
    .prepare(
      `SELECT id, display_name, email, type, url, avatar, label,
              notify_admin_comment, notify_reply
       FROM wl_Users WHERE id IN (${placeholders})`,
    )
    .bind(...ids)
    .all();
  return result.results;
}

/** 公开 2FA 检查：按邮箱查是否启用（只取 2fa 列） */
export async function getUser2faByEmail(
  db: D1Database,
  email: string,
): Promise<{ '2fa': string } | null> {
  return db
    .prepare('SELECT "2fa" FROM wl_Users WHERE email = ?')
    .bind(email)
    .first<{ '2fa': string }>();
}

/** 启用/更新 2FA secret */
export async function setUser2fa(
  db: D1Database,
  userId: number,
  secret: string,
): Promise<void> {
  await db
    .prepare('UPDATE wl_Users SET "2fa" = ? WHERE id = ?')
    .bind(secret, userId)
    .run();
}
