/**
 * 通知编排 —— 解析收件人 + 渲染模板 + 发送。
 *
 * 触发时机（要求评论已 approved，且只应通过 event.waitUntil 异步调用）：
 *   maybeNotifyNewComment 新评论/回复成为 approved 后调用
 *
 * 通知偏好（wl_Users）：
 *   - notify_admin_comment：收到新评论（仅管理员相关）
 *   - notify_reply：有人回复我的评论
 *
 * 上游还有 notifySubmissionApproved（CMS 文档审批通过），本项目未迁移 CMS，
 * 因此该函数与 notify_approve 偏好一并移除。
 */
import type { WalineEnv } from '../env';
import {
  getAdminsForNotify,
  getCommentById,
  getUserById,
} from '../../database/index';
import { sendMail } from './mail';
import {
  renderAdminNewCommentMail,
  renderReplyNotificationMail,
} from './mail-templates';

function siteNameOf(env: WalineEnv): string {
  return env.SITE_NAME || 'Waline';
}

function siteUrlOf(env: WalineEnv): string {
  return env.SITE_URL || '';
}

/** 评论锚点链接：${SITE_URL}${url}#${commentId} */
function buildCommentLink(
  env: WalineEnv,
  url: string | undefined,
  commentId: number,
): string {
  const base = siteUrlOf(env).replace(/\/$/, '');
  const path = (url || '').startsWith('/') ? url : `/${url || ''}`;
  return `${base}${path}#${commentId}`;
}

/**
 * 新评论/回复成为 approved 后调用：
 *   - 非管理员评论 → 通知所有开启「新评论通知」的管理员
 *   - 若为回复（pid 存在）→ 通知被回复评论的作者
 */
export async function maybeNotifyNewComment(
  env: WalineEnv,
  db: D1Database,
  commentId: number,
): Promise<void> {
  const comment = await getCommentById(db, commentId);
  if (!comment) return;
  // 仅对 approved 的评论发送；spam/waiting 不发
  if (comment.status !== 'approved') return;

  const commentLink = buildCommentLink(env, comment.url, comment.id);
  const commentText = comment.orig || comment.comment || '';

  // 评论作者（用于判断是否管理员 + 昵称）
  let author: { type?: string; display_name?: string } | null = null;
  if (comment.user_id != null) {
    author = await getUserById(db, comment.user_id);
  }

  // 场景①：非管理员评论 → 通知所有管理员
  if (author?.type !== 'administrator') {
    const admins = await getAdminsForNotify(db);
    const seen = new Set<string>();
    for (const admin of admins) {
      if (!admin.email || seen.has(admin.email)) continue;
      seen.add(admin.email);
      const { subject, html } = renderAdminNewCommentMail({
        siteName: siteNameOf(env),
        commenterName: author?.display_name || comment.nick || '匿名',
        commentText,
        pageUrl: siteUrlOf(env),
        commentLink,
      });
      await sendMail(env, { to: admin.email, subject, html });
    }
  }

  // 场景②：回复评论 → 通知被回复者
  if (comment.pid != null) {
    const parent = await getCommentById(db, comment.pid);
    if (
      parent &&
      parent.user_id != null &&
      parent.user_id !== comment.user_id
    ) {
      const parentUser = await getUserById(db, parent.user_id);
      // 无用户行时回退父评论的 mail 快照，且视为开启
      const enabled = parentUser ? (parentUser.notify_reply ?? 1) !== 0 : true;
      const recipientEmail = parentUser?.email || parent.mail || '';
      if (enabled && recipientEmail) {
        const { subject, html } = renderReplyNotificationMail({
          siteName: siteNameOf(env),
          replierName: author?.display_name || comment.nick || '匿名',
          commentText,
          pageUrl: siteUrlOf(env),
          commentLink,
          recipientName: parentUser?.display_name || parent.nick || '',
        });
        await sendMail(env, { to: recipientEmail, subject, html });
      }
    }
  }
}
