/**
 * OAuth 数据访问层 —— 授权码（wl_OAuthCode）。
 *
 * 上游该文件同时承载 CMS 的 GitHub App OAuth 授权码流程；本项目未迁移 CMS，
 * 但保留 wl_OAuthCode 表与读写函数，供后续接入使用。
 */

export interface OAuthCodeRecord {
  code: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  user_id: number;
  scope: string;
  state: string;
  expires_at: number;
}

export type OAuthCodeRow = OAuthCodeRecord & { used_at: number | null };

/** 清理已过期/已使用的授权码 */
export async function purgeExpiredOAuthCodes(
  db: D1Database,
  now: number,
): Promise<void> {
  await db
    .prepare(
      'DELETE FROM wl_OAuthCode WHERE expires_at <= ? OR used_at IS NOT NULL',
    )
    .bind(now)
    .run();
}

/** 写入授权码 */
export async function createOAuthCode(
  db: D1Database,
  data: OAuthCodeRecord,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO wl_OAuthCode (
        code, client_id, redirect_uri, code_challenge, code_challenge_method,
        user_id, scope, state, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      data.code,
      data.client_id,
      data.redirect_uri,
      data.code_challenge,
      data.code_challenge_method,
      data.user_id,
      data.scope,
      data.state,
      data.expires_at,
    )
    .run();
}

/** 按 code 取授权码 */
export async function getOAuthCode(
  db: D1Database,
  code: string,
): Promise<OAuthCodeRow | null> {
  return db
    .prepare(
      `SELECT code, client_id, redirect_uri, code_challenge, code_challenge_method,
              user_id, scope, state, expires_at, used_at
       FROM wl_OAuthCode WHERE code = ?`,
    )
    .bind(code)
    .first<OAuthCodeRow>();
}

/** 标记授权码已使用，返回受影响行数（0 = 已被并发使用） */
export async function markOAuthCodeUsed(
  db: D1Database,
  code: string,
  usedAt: number,
): Promise<number> {
  const update = await db
    .prepare(
      'UPDATE wl_OAuthCode SET used_at = ? WHERE code = ? AND used_at IS NULL',
    )
    .bind(usedAt, code)
    .run();
  return update.meta.changes || 0;
}

// 社交登录/绑定相关，复用 users.ts 的实现。
export {
  getUserBySocial,
  getSocialConflict,
  bindSocial,
  createUser,
  countUsers,
  getUserById,
  getUserAuthByEmail,
} from './users';
