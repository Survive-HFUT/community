/**
 * 邮件模板 —— 发件人配置与各通知的文案/样式集中在这里。
 * 不要在这里直接调用 Resend，发送统一走 ./mail.ts 的 sendMail。
 */
import type { WalineEnv } from '../env';

/** 解析发件人显示名称（MAIL_FROM_NAME > SITE_NAME > 默认值） */
function fromName(env: WalineEnv): string {
  return env.MAIL_FROM_NAME || env.SITE_NAME || 'Waline';
}

/** 解析发件人邮箱（MAIL_FROM_EMAIL，需在 Resend 侧验证所属域名） */
function fromEmail(env: WalineEnv): string {
  return env.MAIL_FROM_EMAIL || 'no-reply@example.com';
}

/** 组装发件人（Resend 要求 "Name <email>" 格式） */
export function mailFrom(env: WalineEnv): string {
  return `${fromName(env)} <${fromEmail(env)}>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 邮件外层布局 */
function emailLayout(opts: {
  title: string;
  content: string;
  siteName: string;
}): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#333;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid #eee;">
              <div style="font-size:17px;font-weight:600;color:#1f2329;">${escapeHtml(
                opts.title,
              )}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;font-size:14px;line-height:1.7;">${opts.content}</td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #eee;font-size:12px;color:#8a919f;">
              本邮件由「${escapeHtml(opts.siteName)}」自动发送，请勿直接回复。
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** 正文按钮 */
function linkButton(href: string, text: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td style="border-radius:6px;background:#3b82f6;"><a href="${escapeHtml(
    href,
  )}" style="display:inline-block;padding:10px 22px;color:#fff;font-size:14px;text-decoration:none;">${escapeHtml(
    text,
  )}</a></td></tr></table>`;
}

/** 引用块（展示评论正文） */
function quoteBlock(text: string): string {
  const t = escapeHtml(text).replace(/\n/g, '<br/>');
  return `<div style="margin:12px 0;padding:12px 16px;background:#f7f8fa;border-left:3px solid #e5e7eb;border-radius:4px;color:#4b5563;font-size:13px;">${t}</div>`;
}

export interface MailTemplate {
  subject: string;
  html: string;
}

/** 场景①：非管理员发布评论 → 通知管理员 */
export function renderAdminNewCommentMail(opts: {
  siteName: string;
  commenterName: string;
  commentText: string;
  pageUrl: string;
  commentLink: string;
}): MailTemplate {
  const subject = `[${opts.siteName}] 收到一条新评论`;
  const content = `
    <p>你好，你的站点收到了一条新评论：</p>
    <p style="margin:4px 0;"><strong>${escapeHtml(
      opts.commenterName,
    )}</strong> 评论于 ${escapeHtml(opts.pageUrl)}</p>
    ${quoteBlock(opts.commentText)}
    ${linkButton(opts.commentLink, '查看评论')}`;
  return {
    subject,
    html: emailLayout({ title: subject, content, siteName: opts.siteName }),
  };
}

/** 场景②：有人回复评论 → 通知被回复者 */
export function renderReplyNotificationMail(opts: {
  siteName: string;
  replierName: string;
  commentText: string;
  pageUrl: string;
  commentLink: string;
  recipientName: string;
}): MailTemplate {
  const subject = `[${opts.siteName}] 有人回复了你的评论`;
  const greeting = opts.recipientName
    ? `你好，${escapeHtml(opts.recipientName)}：`
    : '你好：';
  const content = `
    <p>${greeting}</p>
    <p><strong>${escapeHtml(opts.replierName)}</strong> 回复了你在 ${escapeHtml(
      opts.pageUrl,
    )} 的评论：</p>
    ${quoteBlock(opts.commentText)}
    ${linkButton(opts.commentLink, '查看回复')}`;
  return {
    subject,
    html: emailLayout({ title: subject, content, siteName: opts.siteName }),
  };
}
