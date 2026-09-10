/**
 * 评论数据访问层 —— 所有 wl_Comment 相关 SQL 的唯一出口。
 * 业务代码通过 createComment / getRootComments 等函数访问数据库，不再直接写 SQL。
 */

export interface CreateCommentData {
  user_id: number | null;
  /** 渲染后的 HTML */
  comment: string;
  /** 原始 markdown */
  orig: string;
  ip: string;
  link: string;
  mail: string;
  nick: string;
  pid: number | null;
  rid: number | null;
  status: string;
  ua: string;
  url: string;
}

const SORT_ORDER: Record<string, string> = {
  insertedAt_desc: 'insertedAt DESC',
  insertedAt_asc: 'insertedAt ASC',
  like_desc: '"like" DESC',
};

/** 创建评论，返回新评论 id */
export async function createComment(
  db: D1Database,
  data: CreateCommentData,
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO wl_Comment (user_id, comment, orig, ip, link, mail, nick, pid, rid, sticky, status, "like", ua, url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?)`,
    )
    .bind(
      data.user_id,
      data.comment,
      data.orig,
      data.ip,
      data.link,
      data.mail,
      data.nick,
      data.pid,
      data.rid,
      data.status,
      data.ua,
      data.url,
    )
    .run();
  return Number(result.meta.last_row_id);
}

/** 按 id 取评论（回复通知、审批判断用） */
export async function getCommentById(
  db: D1Database,
  id: number,
): Promise<any | null> {
  return db.prepare('SELECT * FROM wl_Comment WHERE id = ?').bind(id).first();
}

/** 根评论总数（某页面） */
export async function countRootComments(
  db: D1Database,
  url: string,
): Promise<number> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) as count FROM wl_Comment WHERE url = ? AND rid IS NULL AND pid IS NULL AND status = 'approved'",
    )
    .bind(url)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

/** 分页根评论（sticky 优先 + 排序） */
export async function getRootComments(
  db: D1Database,
  url: string,
  pageSize: number,
  offset: number,
  sortBy: string,
): Promise<any[]> {
  const orderBy = SORT_ORDER[sortBy] || 'insertedAt DESC';
  const result = await db
    .prepare(
      `SELECT * FROM wl_Comment
       WHERE url = ? AND rid IS NULL AND pid IS NULL AND status = 'approved'
       ORDER BY sticky DESC, ${orderBy}
       LIMIT ? OFFSET ?`,
    )
    .bind(url, pageSize, offset)
    .all();
  return result.results;
}

/** 指定根评论下的子评论 */
export async function getChildComments(
  db: D1Database,
  rootIds: number[],
): Promise<any[]> {
  if (rootIds.length === 0) return [];
  const placeholders = rootIds.map(() => '?').join(',');
  const result = await db
    .prepare(
      `SELECT * FROM wl_Comment
       WHERE rid IN (${placeholders}) AND status = 'approved'
       ORDER BY insertedAt ASC`,
    )
    .bind(...rootIds)
    .all();
  return result.results;
}

/** 最近评论 */
export async function getRecentComments(
  db: D1Database,
  count: number,
): Promise<any[]> {
  const result = await db
    .prepare(
      `SELECT * FROM wl_Comment WHERE status = 'approved'
       ORDER BY insertedAt DESC LIMIT ?`,
    )
    .bind(count)
    .all();
  return result.results;
}

/** 单页面 approved 评论数 */
export async function countApprovedByUrl(
  db: D1Database,
  url: string,
): Promise<number> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) as count FROM wl_Comment WHERE url = ? AND status = 'approved'",
    )
    .bind(url)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

/** 多页面 approved 评论数（GROUP BY url） */
export async function countApprovedGroupByUrl(
  db: D1Database,
  urls: string[],
): Promise<Array<{ url: string; count: number }>> {
  const placeholders = urls.map(() => '?').join(',');
  const result = await db
    .prepare(
      `SELECT url, COUNT(*) as count FROM wl_Comment
       WHERE url IN (${placeholders}) AND status = 'approved'
       GROUP BY url`,
    )
    .bind(...urls)
    .all();
  return result.results as Array<{ url: string; count: number }>;
}

/** 管理员评论列表（含过滤/搜索） */
export async function getAdminCommentPage(
  db: D1Database,
  opts: {
    page: number;
    pageSize: number;
    status?: string;
    keyword?: string;
    ownerEmail?: string;
  },
): Promise<{ total: number; rows: any[] }> {
  let where = '1=1';
  const params: unknown[] = [];

  if (opts.ownerEmail) {
    where += ' AND mail = ?';
    params.push(opts.ownerEmail);
  }
  if (opts.status) {
    where += ' AND status = ?';
    params.push(opts.status);
  }
  if (opts.keyword) {
    const escaped = opts.keyword.replace(/[%_\\]/g, '\\$&');
    where += " AND comment LIKE ? ESCAPE '\\'";
    params.push(`%${escaped}%`);
  }

  const offset = (opts.page - 1) * opts.pageSize;
  const countRow = await db
    .prepare(`SELECT COUNT(*) as count FROM wl_Comment WHERE ${where}`)
    .bind(...params)
    .first<{ count: number }>();

  const result = await db
    .prepare(
      `SELECT * FROM wl_Comment WHERE ${where}
       ORDER BY insertedAt DESC LIMIT ? OFFSET ?`,
    )
    .bind(...params, opts.pageSize, offset)
    .all();

  return { total: countRow?.count ?? 0, rows: result.results };
}

/** 点赞 +1 */
export async function incrementLike(db: D1Database, id: number): Promise<void> {
  await db
    .prepare(
      'UPDATE wl_Comment SET "like" = MAX(0, "like" + 1), updatedAt = datetime(\'now\') WHERE id = ?',
    )
    .bind(id)
    .run();
}

/**
 * 按白名单更新评论字段。
 * 调用方负责校验字段名，这里只做拼接；不处理点赞自增（用 incrementLike）。
 */
export async function updateCommentFields(
  db: D1Database,
  id: number,
  updates: Record<string, unknown>,
): Promise<void> {
  const fields = Object.keys(updates);
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `"${f}" = ?`).join(', ');
  await db
    .prepare(
      `UPDATE wl_Comment SET ${setClauses}, updatedAt = datetime('now') WHERE id = ?`,
    )
    .bind(...Object.values(updates), id)
    .run();
}

/** 级联删除评论（含其下子评论） */
export async function deleteCommentCascade(
  db: D1Database,
  id: number,
): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM wl_Comment WHERE rid = ?').bind(id),
    db.prepare('DELETE FROM wl_Comment WHERE id = ?').bind(id),
  ]);
}

// ---------- RSS 相关 ----------

/** 按页面路径取非隐藏评论（RSS） */
export async function getCommentsByUrlForRss(
  db: D1Database,
  path: string,
  limit: number,
): Promise<any[]> {
  const result = await db
    .prepare(
      `SELECT id, comment, insertedAt, link, nick, url, user_id FROM wl_Comment
       WHERE url = ? AND status NOT IN ('waiting', 'spam')
       ORDER BY insertedAt DESC LIMIT ?`,
    )
    .bind(path, limit)
    .all();
  return result.results;
}

/** 全部最近非隐藏评论（RSS） */
export async function getRecentCommentsForRss(
  db: D1Database,
  limit: number,
): Promise<any[]> {
  const result = await db
    .prepare(
      `SELECT id, comment, insertedAt, link, nick, url, user_id FROM wl_Comment
       WHERE status NOT IN ('waiting', 'spam')
       ORDER BY insertedAt DESC LIMIT ?`,
    )
    .bind(limit)
    .all();
  return result.results;
}

/** 某用户收到的回复：其评论 id 集合（RSS / 通知） */
export async function getUserCommentIds(
  db: D1Database,
  opts: { email?: string; userId?: string | number },
): Promise<number[]> {
  let parentQuery: string;
  const params: Array<string | number> = [];
  if (opts.email && opts.userId) {
    parentQuery =
      "SELECT id FROM wl_Comment WHERE status NOT IN ('waiting', 'spam') AND (mail = ? OR user_id = ?)";
    params.push(opts.email, opts.userId);
  } else if (opts.email) {
    parentQuery =
      "SELECT id FROM wl_Comment WHERE status NOT IN ('waiting', 'spam') AND mail = ?";
    params.push(opts.email);
  } else {
    parentQuery =
      "SELECT id FROM wl_Comment WHERE status NOT IN ('waiting', 'spam') AND user_id = ?";
    params.push(opts.userId!);
  }
  const result = await db
    .prepare(parentQuery)
    .bind(...params)
    .all();
  return result.results.map((r: any) => r.id as number);
}

/** 回复这些父评论的子评论（RSS） */
export async function getCommentsByPidIn(
  db: D1Database,
  parentIds: number[],
  limit: number,
): Promise<any[]> {
  if (parentIds.length === 0) return [];
  const placeholders = parentIds.map(() => '?').join(',');
  const result = await db
    .prepare(
      `SELECT id, comment, insertedAt, link, nick, url, user_id FROM wl_Comment
       WHERE pid IN (${placeholders}) AND status NOT IN ('waiting', 'spam')
       ORDER BY insertedAt DESC LIMIT ?`,
    )
    .bind(...parentIds, limit)
    .all();
  return result.results;
}
