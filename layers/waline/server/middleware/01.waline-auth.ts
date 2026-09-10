import { getUserById } from '../database/index';
import { getWalineEnv, getWalinePathname } from '../waline/context';
import { verifyJwt } from '../waline/jwt';

/**
 * 非阻断式鉴权中间件（复刻上游 Hono 的 `auth` middleware）。
 *
 * token 来源优先级（与上游一致）：
 *   1. `Authorization: Bearer <jwt>`
 *   2. URL `?token=<jwt>`（@waline/admin 打开子页面时用它传递会话）
 *   3. Cookie `TOKEN`（登录时由 /api/token 种下的 httpOnly Cookie）
 *
 * 解析成功且用户未被封禁时写入 `event.context.walineUser`。
 * 任何失败都静默跳过，由各路由自行决定是否要求登录。
 */
export default defineEventHandler(async (event) => {
  // 仅对评论接口生效，避免页面导航也去查库。
  if (!getWalinePathname(event).startsWith('/api/')) return;

  const token = readToken(event);
  if (!token) return;

  let env;
  try {
    env = getWalineEnv(event);
  } catch {
    return;
  }

  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) return;

  try {
    const payload = await verifyJwt(token, jwtSecret);
    if (!payload?.id) return;

    const user = await getUserById(env.DB, payload.id);
    if (!user || user.type === 'banned') return;

    event.context.walineUser = {
      objectId: user.id as number,
      display_name: user.display_name as string,
      email: user.email as string,
      type: user.type as string,
      url: user.url as string,
      avatar: user.avatar as string,
      label: user.label as string | undefined,
      github: user.github as string | undefined,
      twitter: user.twitter as string | undefined,
      facebook: user.facebook as string | undefined,
      google: user.google as string | undefined,
      weibo: user.weibo as string | undefined,
      qq: user.qq as string | undefined,
      '2fa': user['2fa'] as string | undefined,
      notify_admin_comment: user.notify_admin_comment as number | undefined,
      notify_reply: user.notify_reply as number | undefined,
    };
  } catch {
    // token 无效 / 过期 —— 以匿名身份继续
  }
});

function readToken(event: H3Event): string | undefined {
  const header = getRequestHeader(event, 'authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);

  const query = getQuery(event);
  const urlToken = query.token;
  if (typeof urlToken === 'string' && urlToken) return urlToken;

  const cookieToken = getCookie(event, 'TOKEN');
  return cookieToken || undefined;
}
