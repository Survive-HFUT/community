/**
 * 评论数据访问层 —— 所有 wl_Comment 相关查询的唯一出口（Drizzle 实现）。
 * 业务代码通过 createComment / getRootComments 等函数访问数据库，不再直接写 SQL。
 */
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  notInArray,
  sql,
  type SQL,
} from 'drizzle-orm';
import { getDb } from './client';
import { comments, type CommentInsert } from './schema';

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

/** 排序方式 → Drizzle 排序表达式（非法值回退到 insertedAt DESC） */
function orderBySort(sortBy: string) {
  if (sortBy === 'insertedAt_asc') return asc(comments.insertedAt);
  if (sortBy === 'like_desc') return desc(comments.like);
  return desc(comments.insertedAt);
}

/** 创建评论，返回新评论 id */
export async function createComment(
  d1: D1Database,
  data: CreateCommentData,
): Promise<number> {
  const db = getDb(d1);
  const [row] = await db
    .insert(comments)
    .values({
      user_id: data.user_id,
      comment: data.comment,
      orig: data.orig,
      ip: data.ip,
      link: data.link,
      mail: data.mail,
      nick: data.nick,
      pid: data.pid,
      rid: data.rid,
      sticky: 0,
      status: data.status,
      like: 0,
      ua: data.ua,
      url: data.url,
    })
    .returning({ id: comments.id });
  return row!.id;
}

/** 按 id 取评论（回复通知、审批判断用） */
export async function getCommentById(
  d1: D1Database,
  id: number,
): Promise<any | null> {
  const db = getDb(d1);
  const row = await db.select().from(comments).where(eq(comments.id, id)).get();
  return row ?? null;
}

/** 根评论总数（某页面） */
export async function countRootComments(
  d1: D1Database,
  url: string,
): Promise<number> {
  const db = getDb(d1);
  const [row] = await db
    .select({ count: count() })
    .from(comments)
    .where(
      and(
        eq(comments.url, url),
        isNull(comments.rid),
        isNull(comments.pid),
        eq(comments.status, 'approved'),
      ),
    );
  return row?.count ?? 0;
}

/** 分页根评论（sticky 优先 + 排序） */
export async function getRootComments(
  d1: D1Database,
  url: string,
  pageSize: number,
  offset: number,
  sortBy: string,
): Promise<any[]> {
  const db = getDb(d1);
  return db
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.url, url),
        isNull(comments.rid),
        isNull(comments.pid),
        eq(comments.status, 'approved'),
      ),
    )
    .orderBy(desc(comments.sticky), orderBySort(sortBy))
    .limit(pageSize)
    .offset(offset);
}

/** 指定根评论下的子评论 */
export async function getChildComments(
  d1: D1Database,
  rootIds: number[],
): Promise<any[]> {
  if (rootIds.length === 0) return [];
  const db = getDb(d1);
  return db
    .select()
    .from(comments)
    .where(and(inArray(comments.rid, rootIds), eq(comments.status, 'approved')))
    .orderBy(asc(comments.insertedAt));
}

/** 最近评论 */
export async function getRecentComments(
  d1: D1Database,
  limit: number,
): Promise<any[]> {
  const db = getDb(d1);
  return db
    .select()
    .from(comments)
    .where(eq(comments.status, 'approved'))
    .orderBy(desc(comments.insertedAt))
    .limit(limit);
}

/** 单页面 approved 评论数 */
export async function countApprovedByUrl(
  d1: D1Database,
  url: string,
): Promise<number> {
  const db = getDb(d1);
  const [row] = await db
    .select({ count: count() })
    .from(comments)
    .where(and(eq(comments.url, url), eq(comments.status, 'approved')));
  return row?.count ?? 0;
}

/** 多页面 approved 评论数（GROUP BY url） */
export async function countApprovedGroupByUrl(
  d1: D1Database,
  urls: string[],
): Promise<Array<{ url: string; count: number }>> {
  if (urls.length === 0) return [];
  const db = getDb(d1);
  const rows = await db
    .select({ url: comments.url, count: count() })
    .from(comments)
    .where(and(inArray(comments.url, urls), eq(comments.status, 'approved')))
    .groupBy(comments.url);
  return rows.map((row) => ({ url: row.url ?? '', count: row.count }));
}

/** 管理员评论列表（含过滤/搜索） */
export async function getAdminCommentPage(
  d1: D1Database,
  opts: {
    page: number;
    pageSize: number;
    status?: string;
    keyword?: string;
    ownerEmail?: string;
  },
): Promise<{ total: number; rows: any[] }> {
  const db = getDb(d1);

  const conditions: SQL[] = [];
  if (opts.ownerEmail) conditions.push(eq(comments.mail, opts.ownerEmail));
  if (opts.status) conditions.push(eq(comments.status, opts.status));
  if (opts.keyword) {
    // 关键词里的 % 和 _ 需要转义，否则会被当成 LIKE 的通配符
    const escaped = opts.keyword.replace(/[%_\\]/g, '\\$&');
    conditions.push(
      sql`${comments.comment} LIKE ${`%${escaped}%`} ESCAPE '\\'`,
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const offset = (opts.page - 1) * opts.pageSize;
  const [countRow] = await db
    .select({ count: count() })
    .from(comments)
    .where(where);

  const rows = await db
    .select()
    .from(comments)
    .where(where)
    .orderBy(desc(comments.insertedAt))
    .limit(opts.pageSize)
    .offset(offset);

  return { total: countRow?.count ?? 0, rows };
}

/** 点赞 +1 */
export async function incrementLike(d1: D1Database, id: number): Promise<void> {
  const db = getDb(d1);
  await db
    .update(comments)
    .set({
      like: sql`MAX(0, ${comments.like} + 1)`,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(comments.id, id));
}

/**
 * 按白名单更新评论字段。
 * 调用方给出「想改的字段」，列名由下面的白名单收敛，非法字段名会被忽略；
 * 不处理点赞自增（用 incrementLike）。
 */
export async function updateCommentFields(
  d1: D1Database,
  id: number,
  updates: Record<string, unknown>,
): Promise<void> {
  const COLUMNS = {
    user_id: comments.user_id,
    comment: comments.comment,
    orig: comments.orig,
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
  } as const;

  const set: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(updates)) {
    if (field in COLUMNS) set[field] = value;
  }
  if (Object.keys(set).length === 0) return;

  const db = getDb(d1);
  await db
    .update(comments)
    .set({
      ...set,
      updatedAt: sql`(datetime('now'))`,
    } as unknown as Partial<CommentInsert>)
    .where(eq(comments.id, id));
}

/** 级联删除评论（含其下子评论） */
export async function deleteCommentCascade(
  d1: D1Database,
  id: number,
): Promise<void> {
  const db = getDb(d1);
  await db.batch([
    db.delete(comments).where(eq(comments.rid, id)),
    db.delete(comments).where(eq(comments.id, id)),
  ]);
}

// ---------- RSS 相关 ----------

/** RSS 只需要这些列 */
const RSS_COLUMNS = {
  id: comments.id,
  comment: comments.comment,
  insertedAt: comments.insertedAt,
  link: comments.link,
  nick: comments.nick,
  url: comments.url,
  user_id: comments.user_id,
} as const;

/** 对前端隐藏的评论状态 */
const HIDDEN_STATUSES = ['waiting', 'spam'];

/** 按页面路径取非隐藏评论（RSS） */
export async function getCommentsByUrlForRss(
  d1: D1Database,
  path: string,
  limit: number,
): Promise<any[]> {
  const db = getDb(d1);
  return db
    .select(RSS_COLUMNS)
    .from(comments)
    .where(
      and(eq(comments.url, path), notInArray(comments.status, HIDDEN_STATUSES)),
    )
    .orderBy(desc(comments.insertedAt))
    .limit(limit);
}

/** 全部最近非隐藏评论（RSS） */
export async function getRecentCommentsForRss(
  d1: D1Database,
  limit: number,
): Promise<any[]> {
  const db = getDb(d1);
  return db
    .select(RSS_COLUMNS)
    .from(comments)
    .where(notInArray(comments.status, HIDDEN_STATUSES))
    .orderBy(desc(comments.insertedAt))
    .limit(limit);
}

/** 某用户收到的回复：其评论 id 集合（RSS / 通知） */
export async function getUserCommentIds(
  d1: D1Database,
  opts: { email?: string; userId?: string | number },
): Promise<number[]> {
  const db = getDb(d1);

  const conditions: SQL[] = [notInArray(comments.status, HIDDEN_STATUSES)];
  if (opts.email) conditions.push(eq(comments.mail, opts.email));
  // userId 允许是数字或字符串（部分调用会直接传 query 字符串），
  // 这里用 sql`` 绑定原始值，保留 SQLite 列的亲和性转换行为。
  if (opts.userId !== undefined) {
    conditions.push(sql`${comments.user_id} = ${opts.userId}`);
  }

  const rows = await db
    .select({ id: comments.id })
    .from(comments)
    .where(and(...conditions));
  return rows.map((row) => row.id);
}

/** 回复这些父评论的子评论（RSS） */
export async function getCommentsByPidIn(
  d1: D1Database,
  parentIds: number[],
  limit: number,
): Promise<any[]> {
  if (parentIds.length === 0) return [];
  const db = getDb(d1);
  return db
    .select(RSS_COLUMNS)
    .from(comments)
    .where(
      and(
        inArray(comments.pid, parentIds),
        notInArray(comments.status, HIDDEN_STATUSES),
      ),
    )
    .orderBy(desc(comments.insertedAt))
    .limit(limit);
}
