/**
 * 邮件发送封装 —— 直接调用 Resend 的 REST API（不用官方 SDK）。
 *
 * 为什么不用 `resend` 包：它的入口会静态引用可选的 `@react-email/render` /
 * React 相关依赖，打进 Cloudflare Workers 产物时会解析失败并显著增大体积。
 * 这里只用 fetch，零依赖。
 *
 * - 未配置 RESEND_API_KEY 时仅打日志并返回 false（不影响业务）。
 * - 发送失败一律吞掉并记录，绝不抛出，避免影响评论/通知主流程。
 */
import type { WalineEnv } from '../env';
import { mailFrom } from './mail-templates';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  /** 纯文本备用版本（可选） */
  text?: string;
}

/**
 * 发送一封邮件。
 * @returns 是否发送成功（未配置 key / 发送失败均为 false）
 */
export async function sendMail(
  env: WalineEnv,
  opts: MailOptions,
): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[mail] RESEND_API_KEY 未配置，跳过发送', {
      to: opts.to,
      subject: opts.subject,
    });
    return false;
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: mailFrom(env),
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('[mail] Resend 发送失败', response.status, detail);
      return false;
    }

    console.log('[mail] 已发送', { to: opts.to, subject: opts.subject });
    return true;
  } catch (err) {
    console.error('[mail] 发送异常', err);
    return false;
  }
}
