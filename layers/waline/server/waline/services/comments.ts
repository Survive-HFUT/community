/**
 * 评论业务逻辑 —— 从上游 `server/router/waline/comment.ts`（790 行 Hono 路由）
 * 平移过来，只把 `c.req.* / c.env / c.json` 换成 Nitro 的取值方式。
 */
import type { WalineEnv } from '../env';
import {
  countApprovedByUrl,
  countApprovedGroupByUrl,
  countRootComments,
  createComment,
  deleteCommentCascade,
  getAdminCommentPage,
  getChildComments,
  getCommentById,
  getCommentsByPidIn,
  getCommentsByUrlForRss,
  getRecentComments as getRecentCommentsRows,
  getRecentCommentsForRss,
  getRootComments,
  getSettings,
  getUserCommentIds,
  getUsersByIds,
  incrementLike,
  updateCommentFields,
} from '../../database/index';
import { getAvatar } from '../utils/avatar';
import { renderMarkdown } from '../utils/markdown';
import { parseUA } from '../utils/ua';
import { maybeNotifyNewComment } from '../utils/notify';
import {
  getWalineEnv,
  getWalineIp,
  queryArray,
  queryInt,
  queryString,
  requireAdmin,
  useWalineUser,
  walineFail,
  walineOk,
  walineWaitUntil,
} from '../context';

type Envelope = Record<string, unknown>;

// ---------- GET /api/comment ----------

/** `?type=recent` —— 最近评论 */
export async function recentCommentsResponse(
  event: H3Event,
): Promise<Envelope> {
  const env = getWalineEnv(event);
  const count = Math.min(50, Math.max(1, queryInt(event, 'count', 10)));

  const rows = await getRecentCommentsRows(env.DB, count);
  const userMap = await fetchCommentUsers(env.DB, rows);

  return walineOk(
    await Promise.all(rows.map((r) => formatComment(r, false, userMap))),
  );
}

/** `?type=count` —— 一个或多个页面的 approved 评论数 */
export async function commentCountResponse(event: H3Event): Promise<Envelope> {
  const env = getWalineEnv(event);
  const paths = queryArray(event, 'path', 'path[]');
  if (paths.length === 0) return { errno: 0, errmsg: '', data: 0 };

  if (paths.length === 1) {
    return walineOk([await countApprovedByUrl(env.DB, paths[0])]);
  }

  const rows = await countApprovedGroupByUrl(env.DB, paths);
  const countMap = Object.fromEntries(rows.map((r) => [r.url, r.count]));
  return walineOk(paths.map((u) => countMap[u] || 0));
}

/** `?type=list` —— 管理端分页评论列表 */
export async function adminCommentListResponse(
  event: H3Event,
): Promise<Envelope> {
  const env = getWalineEnv(event);
  const user = requireAdmin(event);

  const page = Math.max(1, queryInt(event, 'page', 1));
  const pageSize = Math.min(100, Math.max(1, queryInt(event, 'pageSize', 10)));
  const status = queryString(event, 'status');
  const keyword = queryString(event, 'keyword');
  const owner = queryString(event, 'owner');

  const { total, rows } = await getAdminCommentPage(env.DB, {
    page,
    pageSize,
    status: status || undefined,
    keyword: keyword || undefined,
    ownerEmail: owner === 'mine' ? user.email : undefined,
  });

  const userMap = await fetchCommentUsers(env.DB, rows);
  return walineOk({
    page,
    pageSize,
    spamCount: 0,
    waitingCount: 0,
    totalPages: Math.ceil(total / pageSize),
    data: await Promise.all(rows.map((r) => formatComment(r, true, userMap))),
  });
}

/** 默认 —— 按 path 分页的线程化评论列表 */
export async function commentListResponse(event: H3Event): Promise<Envelope> {
  const env = getWalineEnv(event);

  const path = queryString(event, 'path');
  if (!path) return walineFail(event, 'path is required', 400);

  const page = Math.max(1, queryInt(event, 'page', 1));
  const pageSize = Math.min(100, Math.max(1, queryInt(event, 'pageSize', 10)));
  const sortBy = queryString(event, 'sortBy') || 'insertedAt_desc';

  const totalCount = await countRootComments(env.DB, path);
  const rootComments = await getRootComments(
    env.DB,
    path,
    pageSize,
    (page - 1) * pageSize,
    sortBy,
  );

  const rootIds = rootComments.map((r) => r.id);
  const children = await getChildComments(env.DB, rootIds);

  // 预取 user，避免每条评论都查一次库（N+1）
  const userMap = await fetchCommentUsers(env.DB, [
    ...rootComments,
    ...children,
  ]);

  const data = await Promise.all(
    rootComments.map(async (root) => ({
      ...(await formatComment(root, false, userMap)),
      children: await Promise.all(
        children
          .filter((child) => child.rid === root.id)
          .map((child) => formatComment(child, false, userMap)),
      ),
    })),
  );

  return walineOk({
    page,
    pageSize,
    count: totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    data,
  });
}

// ---------- POST /api/comment ----------

interface CreateCommentBody {
  comment?: unknown;
  nick?: unknown;
  mail?: unknown;
  link?: unknown;
  url?: unknown;
  ua?: unknown;
  pid?: number | null;
  rid?: number | null;
}

/** 创建评论：字段校验 → 强制登录 → 状态决策 → markdown 渲染 → 入库 → 异步反垃圾/通知 */
export async function createCommentResponse(
  event: H3Event,
  body: CreateCommentBody,
): Promise<Envelope> {
  const env = getWalineEnv(event);
  const { comment, nick, mail, link, url, ua, pid, rid } = body;

  if (!url) return walineFail(event, 'url is required', 400);
  if (!comment) return walineFail(event, 'comment is required', 400);

  // 字段长度上限（D1 单行约 1MB，Workers CPU 预算也有限）
  if (typeof comment !== 'string' || comment.length > 65536) {
    return walineFail(event, 'comment is too long (max 64KB)', 400);
  }
  if (nick && (typeof nick !== 'string' || nick.length > 255)) {
    return walineFail(event, 'nick is too long (max 255 chars)', 400);
  }
  if (mail && (typeof mail !== 'string' || mail.length > 255)) {
    return walineFail(event, 'mail is too long (max 255 chars)', 400);
  }
  if (link && (typeof link !== 'string' || link.length > 255)) {
    return walineFail(event, 'link is too long (max 255 chars)', 400);
  }
  if (typeof url !== 'string' || url.length > 1024) {
    return walineFail(event, 'url is too long (max 1024 chars)', 400);
  }
  if (ua && (typeof ua !== 'string' || ua.length > 1024)) {
    return walineFail(event, 'ua is too long (max 1024 chars)', 400);
  }

  const ip = getWalineIp(event);
  const user = useWalineUser(event);

  // 强制登录模式：拒绝匿名评论
  if (!user) return walineFail(event, 'Please login first', 401, 401);

  // 初始状态：
  //   - user_comment_default_status：已登录用户（本项目强制登录，必定走这支）
  //   - comment_default_status / AUDIT：匿名用户分支（保留以兼容上游语义）
  const statusSettings = await getSettings(env.DB, [
    'comment_default_status',
    'user_comment_default_status',
  ]).catch(() => ({}) as Record<string, string>);

  let status: string;
  if (user) {
    status =
      statusSettings.user_comment_default_status === 'waiting'
        ? 'waiting'
        : 'approved';
  } else {
    const defaultStatus = statusSettings.comment_default_status;
    if (defaultStatus === 'waiting' || defaultStatus === 'approved') {
      status = defaultStatus;
    } else if (env.AUDIT) {
      status = 'waiting';
    } else {
      status = 'approved';
    }
  }

  const rendered = renderMarkdown(comment);

  const commentId = await createComment(env.DB, {
    user_id: user.objectId,
    comment: rendered,
    orig: comment,
    ip,
    link: (link as string) || '',
    mail: user.email || (mail as string) || '',
    nick: user.display_name || (nick as string) || '',
    pid: pid ?? null,
    rid: rid ?? null,
    status,
    ua: (ua as string) || '',
    url,
  });

  const newComment = await getCommentById(env.DB, commentId);

  // 异步发邮件通知（仅 approved 的评论才会真正发信，见 utils/notify.ts）
  if (newComment) {
    walineWaitUntil(
      event,
      maybeNotifyNewComment(env, env.DB, commentId).catch((err) =>
        console.error('[Comment Notify Error]', err?.message || err),
      ),
    );
  }

  setResponseStatus(event, 201);
  return walineOk(await formatComment(newComment));
}

// ---------- PUT /api/comment/:id ----------

interface UpdateCommentBody {
  like?: boolean | number;
  status?: string;
  comment?: string;
  sticky?: boolean;
  nick?: string;
  mail?: string;
  link?: string;
  url?: string;
  ua?: string;
  ip?: string;
  user_id?: number;
  pid?: number;
  rid?: number;
}

/** 更新评论：点赞任何人可做，其它字段仅管理员 */
export async function updateCommentResponse(
  event: H3Event,
  id: number,
  body: UpdateCommentBody,
): Promise<Envelope> {
  const env = getWalineEnv(event);
  const result = await applyCommentUpdate(event, env, id, body);
  if (result.early) return result.early;

  const updated = await getCommentById(env.DB, id);

  // 其它状态 → approved 时异步发通知（仅「通过审核后发」场景）
  if (body.status === 'approved' && result.existing?.status !== 'approved') {
    walineWaitUntil(
      event,
      maybeNotifyNewComment(env, env.DB, id).catch((err) =>
        console.error('[Comment Notify Error]', err?.message || err),
      ),
    );
  }

  return walineOk(await formatComment(updated));
}

async function applyCommentUpdate(
  event: H3Event,
  env: WalineEnv,
  id: number,
  body: UpdateCommentBody,
): Promise<{ early?: Envelope; existing?: any }> {
  // 点赞（任何人）
  if (body.like !== undefined && typeof body.like === 'boolean') {
    await incrementLike(env.DB, id);
    const updated = await getCommentById(env.DB, id);
    return { early: walineOk(await formatComment(updated)) };
  }

  if (useWalineUser(event)?.type !== 'administrator') {
    return { early: walineFail(event, 'Unauthorized', 403) };
  }

  // 记录更新前状态，用于通知判断
  const existing = await getCommentById(env.DB, id);

  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.comment !== undefined) {
    updates.comment = renderMarkdown(body.comment);
    updates.orig = body.comment;
  }
  if (body.sticky !== undefined) updates.sticky = body.sticky ? 1 : 0;
  if (body.nick !== undefined) updates.nick = body.nick;
  if (body.mail !== undefined) updates.mail = body.mail;
  if (body.link !== undefined) updates.link = body.link;
  if (body.url !== undefined) updates.url = body.url;
  if (body.ua !== undefined) updates.ua = body.ua;
  if (body.ip !== undefined) updates.ip = body.ip;
  if (body.user_id !== undefined) updates.user_id = body.user_id;
  if (body.pid !== undefined) updates.pid = body.pid;
  if (body.rid !== undefined) updates.rid = body.rid;
  if (typeof body.like === 'number') updates.like = Math.max(0, body.like);

  if (Object.keys(updates).length === 0) {
    return { early: walineFail(event, 'No fields to update', 400) };
  }

  await updateCommentFields(env.DB, id, updates);
  return { existing };
}

// ---------- DELETE /api/comment/:id ----------

export async function deleteCommentResponse(
  event: H3Event,
  id: number,
): Promise<Envelope> {
  const env = getWalineEnv(event);
  requireAdmin(event);

  // 级联删除：连同其下子评论
  await deleteCommentCascade(env.DB, id);
  return walineOk();
}

// ---------- GET /api/comment/rss ----------

export async function commentRssResponse(event: H3Event): Promise<string> {
  const env = getWalineEnv(event);

  const path = queryString(event, 'path');
  const email = queryString(event, 'email');
  const userId = queryString(event, 'user_id');
  const limit = Math.min(Math.max(queryInt(event, 'count', 20), 1), 50);

  const siteUrl = env.SITE_URL || '';
  const siteName = env.SITE_NAME || 'Waline';

  let comments: any[];

  if (path) {
    comments = await getCommentsByUrlForRss(env.DB, path, limit);
  } else if (email || userId) {
    const parentIds = await getUserCommentIds(env.DB, {
      email: email || undefined,
      userId: userId || undefined,
    });

    if (parentIds.length === 0) {
      comments = [];
    } else {
      comments = await getCommentsByPidIn(env.DB, parentIds, limit);
    }
  } else {
    comments = await getRecentCommentsForRss(env.DB, limit);
  }

  const userIds = [...new Set(comments.map((r) => r.user_id).filter(Boolean))];
  const users =
    userIds.length > 0 ? await getUsersByIds(env.DB, userIds as number[]) : [];

  const items = comments.map((comment) => {
    const user = users.find((u) => u.id === comment.user_id);
    const nick = user?.display_name || comment.nick || 'Anonymous';
    const commentUrl = buildAbsoluteUrl(siteUrl, comment.url);
    const itemLink = commentUrl ? `${commentUrl}#${comment.id}` : '';

    return {
      title: `${nick} commented${comment.url ? ` on ${comment.url}` : ''}`,
      link: itemLink || commentUrl,
      guid: String(comment.id),
      pubDate: comment.insertedAt
        ? new Date(`${comment.insertedAt}Z`).toUTCString()
        : new Date().toUTCString(),
      description: comment.comment || '',
    };
  });

  const title = path
    ? `${siteName} Comments for ${path}`
    : email || userId
      ? `${siteName} Reply Comments`
      : `${siteName} Recent Comments`;
  const description = path
    ? `Recent comments for ${path}.`
    : email || userId
      ? 'Recent reply comments.'
      : 'Recent comments.';

  setResponseHeader(
    event,
    'content-type',
    'application/rss+xml; charset=utf-8',
  );
  return buildRssXml({ title, link: siteUrl, description, items });
}

// ---------- 内部辅助 ----------

/** 批量取评论作者，避免 N+1 */
async function fetchCommentUsers(
  db: D1Database,
  rows: any[],
): Promise<Map<number, any>> {
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const userMap = new Map<number, any>();
  if (userIds.length === 0) return userMap;

  const users = await getUsersByIds(db, userIds as number[]);
  for (const user of users) {
    userMap.set(user.id, user);
  }
  return userMap;
}

/** 输出 @waline/client 兼容的评论对象 */
async function formatComment(
  row: any,
  isAdmin = false,
  userMap?: Map<number, any>,
): Promise<Record<string, any> | null> {
  if (!row) return null;
  const user = row.user_id ? userMap?.get(row.user_id) : null;

  const nick = user?.display_name || row.nick || 'Anonymous';
  const mail = user?.email || row.mail || '';
  const link = user?.url || row.link || '';

  const { browser, os } = parseUA(row.ua || '');
  const avatar = user?.avatar || (await getAvatar(mail));

  // 兼容历史数据：可能是数字时间戳，也可能是带空格的字符串
  const rawDate = row.insertedAt || row.createdAt;
  let time = 0;
  let isoDate = '';

  if (rawDate) {
    if (typeof rawDate === 'number') {
      time = rawDate;
      isoDate = new Date(time).toISOString();
    } else {
      const s = String(rawDate).replace(' ', 'T');
      const d = new Date(s.endsWith('Z') || s.includes('T') ? s : `${s}Z`);
      time = d.getTime();
      isoDate = Number.isNaN(time) ? '' : d.toISOString();
    }
  }

  const result: Record<string, any> = {
    objectId: row.id,
    comment: row.comment || '',
    orig: row.orig || row.comment || '',
    nick,
    link,
    avatar,
    browser,
    os,
    time: Number.isNaN(time) ? 0 : time,
    insertedAt: isoDate,
    createdAt: isoDate,
    status: row.status,
    like: row.like ?? 0,
    url: row.url,
    sticky: Boolean(row.sticky),
    user_id: row.user_id,
    type: user?.type || (row.user_id ? 'guest' : ''),
    label: user?.label || '',
  };

  // @waline/client 通过 `rid` 是否存在来区分回复与根评论，
  // 根评论不要输出这两个可空字段。
  if (row.pid !== null && row.pid !== undefined) result.pid = row.pid;
  if (row.rid !== null && row.rid !== undefined) result.rid = row.rid;

  if (isAdmin) {
    result.mail = mail;
    result.ip = row.ip || '';
    result.ua = row.ua || '';
  }

  return result;
}

// ---------- RSS 辅助 ----------

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildAbsoluteUrl(baseUrl: string, path: string | undefined): string {
  if (!path) return baseUrl || '';
  if (/^(https?:)?\/\//i.test(path)) return path;
  if (!baseUrl) return path;
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function buildRssXml({
  title,
  link,
  description,
  items,
}: {
  title: string;
  link: string;
  description: string;
  items: {
    title: string;
    link: string;
    guid: string;
    pubDate: string;
    description: string;
  }[];
}): string {
  const now = new Date().toUTCString();
  const itemsXml = items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid>${escapeXml(item.guid)}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <description><![CDATA[${item.description}]]></description>
    </item>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(description)}</description>
    <pubDate>${now}</pubDate>
${itemsXml}
  </channel>
</rss>`;
}
