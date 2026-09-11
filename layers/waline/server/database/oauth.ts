/**
 * OAuth 数据访问层 —— 授权码（wl_OAuthCode）。
 *
 * 上游该文件同时承载 CMS 的 GitHub App OAuth 授权码流程；本项目未迁移 CMS，
 * 但保留 wl_OAuthCode 表与读写函数，供后续接入使用。
 */
import { and, eq, isNotNull, isNull, lte, or } from 'drizzle-orm';
import { getDb } from './client';
import { oauthCodes } from './schema';

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
  d1: D1Database,
  now: number,
): Promise<void> {
  const db = getDb(d1);
  await db
    .delete(oauthCodes)
    .where(or(lte(oauthCodes.expires_at, now), isNotNull(oauthCodes.used_at)));
}

/** 写入授权码 */
export async function createOAuthCode(
  d1: D1Database,
  data: OAuthCodeRecord,
): Promise<void> {
  const db = getDb(d1);
  await db.insert(oauthCodes).values({
    code: data.code,
    client_id: data.client_id,
    redirect_uri: data.redirect_uri,
    code_challenge: data.code_challenge,
    code_challenge_method: data.code_challenge_method,
    user_id: data.user_id,
    scope: data.scope,
    state: data.state,
    expires_at: data.expires_at,
  });
}

/** 按 code 取授权码 */
export async function getOAuthCode(
  d1: D1Database,
  code: string,
): Promise<OAuthCodeRow | null> {
  const db = getDb(d1);
  const row = await db
    .select({
      code: oauthCodes.code,
      client_id: oauthCodes.client_id,
      redirect_uri: oauthCodes.redirect_uri,
      code_challenge: oauthCodes.code_challenge,
      code_challenge_method: oauthCodes.code_challenge_method,
      user_id: oauthCodes.user_id,
      scope: oauthCodes.scope,
      state: oauthCodes.state,
      expires_at: oauthCodes.expires_at,
      used_at: oauthCodes.used_at,
    })
    .from(oauthCodes)
    .where(eq(oauthCodes.code, code))
    .get();

  return row ?? null;
}

/** 标记授权码已使用，返回受影响行数（0 = 已被并发使用） */
export async function markOAuthCodeUsed(
  d1: D1Database,
  code: string,
  usedAt: number,
): Promise<number> {
  const db = getDb(d1);
  const updated = await db
    .update(oauthCodes)
    .set({ used_at: usedAt })
    .where(and(eq(oauthCodes.code, code), isNull(oauthCodes.used_at)))
    .returning({ code: oauthCodes.code });
  return updated.length;
}

// 社交登录/绑定相关，复用 users.ts 的实现。
export {
  bindSocial, countUsers, createUser, getSocialConflict, getUserAuthByEmail, getUserById, getUserBySocial
} from './users';

