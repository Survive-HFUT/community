/**
 * 前端类型定义 —— 对应 /api/token、/api/user、/api/comment、/api/settings 的响应结构。
 *
 * 已按需求移除 LLM 审查（llm_*）与 CMS 审批通知（notify_approve）相关字段。
 */

export type UserType = 'administrator' | 'guest' | 'banned' | (string & {});

export interface UserInfo {
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
  '2fa'?: boolean;
  mailMd5?: string;
  /** 邮件通知偏好（0/1） */
  notify_admin_comment?: number;
  notify_reply?: number;
}

export interface AdminUser extends UserInfo {
  createdAt?: string;
}

export interface UserListResp {
  page: number;
  pageSize: number;
  totalPages: number;
  data: AdminUser[];
}

export type CommentStatus = 'approved' | 'waiting' | 'spam';

export interface Comment {
  objectId: string | number;
  /** 渲染后的 HTML（markdown 输出）—— 展示时优先使用 `orig` */
  comment: string;
  /** 原始 markdown / 纯文本 */
  orig?: string;
  nick: string;
  mail?: string;
  link?: string;
  avatar: string;
  browser?: string;
  os?: string;
  /** 毫秒时间戳 */
  time: number;
  insertedAt: string;
  createdAt?: string;
  status: CommentStatus;
  like: number;
  url?: string;
  sticky: boolean;
  user_id?: number;
  type?: string;
  label?: string;
  /** 仅管理端列表返回 */
  ip?: string;
  ua?: string;
  pid?: string | number;
  rid?: string | number;
  at?: string;
  /** 嵌套回复（仅根评论） */
  children?: Comment[];
}

export interface CommentListResp {
  page: number;
  pageSize: number;
  count: number;
  totalPages: number;
  data: Comment[];
}

export interface Settings {
  waline_client_version?: string;
  waline_admin_version?: string;
  comment_default_status?: string;
  user_comment_default_status?: string;
  [key: string]: string | undefined;
}

export interface LoginData extends UserInfo {
  token: string;
}
