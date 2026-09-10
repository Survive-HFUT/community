/**
 * Cloudflare 运行时绑定与环境变量。
 * 来源：wrangler.jsonc 的 `vars` + 本地 .dev.vars + 线上 `wrangler secret`。
 */
export interface WalineEnv {
  /** D1 数据库绑定 */
  DB: D1Database;

  /** 签发/校验登录 JWT（HS256）的密钥。缺失时登录会返回 500。 */
  JWT_SECRET?: string;

  /** 站点名称，用于 RSS 标题与邮件标题 */
  SITE_NAME?: string;
  /** 站点地址，用于邮件里的跳转链接与 RSS 绝对地址 */
  SITE_URL?: string;

  /** 兼容旧配置：非空时新评论默认进入 waiting（除非设置里显式指定） */
  AUDIT?: string;

  /** 社交登录网关，默认 https://oauth.lithub.cc */
  OAUTH_URL?: string;

  /** Resend API key，未配置则跳过邮件发送 */
  RESEND_API_KEY?: string;
  /** 发件人显示名称，缺省取 SITE_NAME */
  MAIL_FROM_NAME?: string;
  /** 发件人邮箱（需在 Resend 侧验证该域名），缺省 no-reply@example.com */
  MAIL_FROM_EMAIL?: string;
}

/** 已通过 JWT 校验并补全资料的当前登录用户 */
export interface WalineUser {
  objectId: number;
  display_name: string;
  email: string;
  type: string;
  url: string;
  avatar: string;
  label?: string;
  github?: string;
  twitter?: string;
  facebook?: string;
  google?: string;
  weibo?: string;
  qq?: string;
  '2fa'?: string;
  /** 邮件通知偏好（0/1，缺省视为开启） */
  notify_admin_comment?: number;
  notify_reply?: number;
}
