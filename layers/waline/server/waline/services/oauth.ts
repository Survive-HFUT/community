/**
 * 社交登录 / 账号绑定 —— 从上游 `server/router/waline/oauth.ts` 平移。
 *
 * 两步流程（与官方 Waline 一致）：
 *   1. 无 `code`：302 到外部 OAuth 网关，回跳地址指向本端点
 *   2. 有 `code`：换取用户信息 → 绑定 / 建号 → 签发 JWT → 302 回前端并带上 `?token=`
 */
import {
  bindSocial,
  countUsers,
  createUser,
  getUserAuthByEmail,
  getUserById,
  getUserBySocial,
  getSocialConflict,
} from '../../database/index';
import { signJwt, verifyJwt } from '../jwt';
import { getWalineEnv, queryString, walineFail } from '../context';

const DEFAULT_OAUTH_URL = 'https://oauth.lithub.cc';

/** 未指定 / 非法的 redirect 一律回到仪表盘 */
const DEFAULT_REDIRECT = '/';

export async function oauthResponse(event: H3Event): Promise<unknown> {
  const env = getWalineEnv(event);

  const type = queryString(event, 'type');
  const code = queryString(event, 'code');
  const state = queryString(event, 'state');
  const redirect = sanitizeRedirect(queryString(event, 'redirect'));
  const oauthUrl = env.OAUTH_URL || DEFAULT_OAUTH_URL;

  if (!type) return walineFail(event, 'type is required', 400);

  // 第一步：没有 code → 跳转到 OAuth 网关
  if (!code) {
    const requestUrl = getRequestURL(event);
    const callbackUrl = `${requestUrl.origin}/api/oauth?redirect=${encodeURIComponent(redirect)}&type=${encodeURIComponent(type)}`;
    // state 透传用户当前的 JWT，用于「已登录时绑定社交账号」
    const loginUrl = `${oauthUrl}/${type}?redirect=${encodeURIComponent(callbackUrl)}&state=${encodeURIComponent(state)}`;
    return sendRedirect(event, loginUrl, 302);
  }

  // 第二步：拿 code 换用户信息
  try {
    const params = new URLSearchParams({ code });
    if (state) params.set('state', state);

    const resp = await fetch(`${oauthUrl}/${type}?${params.toString()}`, {
      headers: { 'User-Agent': '@waline' },
    });

    if (!resp.ok) {
      console.error(`OAuth request failed: ${resp.status} ${resp.statusText}`);
      return sendRedirect(event, `${redirect}?error=oauth_failed`, 302);
    }

    const oauthUser = (await resp.json()) as Record<string, any>;
    const socialId = String(
      oauthUser.id || oauthUser.login || oauthUser.name || '',
    );
    const socialName = String(
      oauthUser.name || oauthUser.login || oauthUser.display_name || '',
    );
    const socialEmail = String(oauthUser.email || '');
    const socialAvatar = String(oauthUser.avatar_url || oauthUser.avatar || '');
    const socialUrl = String(
      oauthUser.html_url || oauthUser.url || oauthUser.blog || '',
    );

    if (!socialId) {
      return sendRedirect(event, `${redirect}?error=oauth_no_id`, 302);
    }

    const socialField = getSocialField(type);
    const jwtSecret = env.JWT_SECRET;

    // 账号绑定流程：state 里是当前登录用户的 JWT
    if (state && jwtSecret && socialField) {
      try {
        const payload = await verifyJwt(state, jwtSecret);
        if (payload?.id) {
          const linkTarget = await getUserById(env.DB, payload.id);

          if (linkTarget) {
            const conflict = await getSocialConflict(
              env.DB,
              socialField,
              socialId,
              payload.id,
            );
            if (conflict) {
              return sendRedirect(
                event,
                `${redirect}?error=oauth_already_bound`,
                302,
              );
            }

            await bindSocial(env.DB, payload.id, socialField, socialId);

            const token = await signJwt({ id: payload.id }, jwtSecret);
            return sendRedirect(
              event,
              `${redirect}${separator(redirect)}token=${encodeURIComponent(token)}`,
              302,
            );
          }
        }
      } catch {
        // state 不是合法 JWT —— 落到普通登录流程
      }
    }

    // 普通社交登录：先按社交 id 找，再按邮箱找，都没有就建号
    let user: Record<string, unknown> | null = null;

    if (socialField) {
      user = await getUserBySocial(env.DB, socialField, socialId);
    }

    if (!user && socialEmail) {
      user = await getUserAuthByEmail(env.DB, socialEmail);
      if (user && socialField) {
        await bindSocial(env.DB, Number(user.id), socialField, socialId);
      }
    }

    if (!user) {
      const isFirst = (await countUsers(env.DB)) === 0;
      const email = socialEmail || `${type}_${socialId}@oauth.local`;

      const userId = await createUser(env.DB, {
        display_name: socialName || socialId,
        email,
        password: '',
        type: isFirst ? 'administrator' : 'guest',
        url: socialUrl,
        avatar: socialAvatar,
        socialField: socialField || undefined,
        socialId,
      });

      user = await getUserById(env.DB, userId);
    }

    if (!user) {
      return sendRedirect(event, `${redirect}?error=oauth_create_failed`, 302);
    }

    if ((user.type as string) === 'banned') {
      return sendRedirect(event, `${redirect}?error=account_banned`, 302);
    }

    if (!jwtSecret) {
      return sendRedirect(event, `${redirect}?error=server_error`, 302);
    }

    const token = await signJwt({ id: user.id as number }, jwtSecret);
    return sendRedirect(
      event,
      `${redirect}${separator(redirect)}token=${encodeURIComponent(token)}`,
      302,
    );
  } catch (e) {
    console.error('OAuth error: ', e);
    return sendRedirect(event, `${redirect}?error=oauth_error`, 302);
  }
}

function separator(redirect: string): string {
  return redirect.includes('?') ? '&' : '?';
}

/** 只允许站内相对路径，避免开放重定向 */
function sanitizeRedirect(input: string): string {
  if (!input?.startsWith('/') || input.startsWith('//'))
    return DEFAULT_REDIRECT;
  return input;
}

/** 社交类型 → wl_Users 列名白名单（防止 SQL 注入） */
function getSocialField(type: string): string | null {
  const map: Record<string, string> = {
    github: 'github',
    twitter: 'twitter',
    facebook: 'facebook',
    google: 'google',
    weibo: 'weibo',
    qq: 'qq',
  };
  return map[type] || null;
}
