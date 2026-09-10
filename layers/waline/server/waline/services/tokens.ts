/**
 * 登录 / 会话 / 两步验证 —— 从上游 `server/router/waline/token.ts` 平移。
 */
import {
  getUser2faByEmail,
  getUserAuthByEmail,
  setUser2fa,
} from '../../database/index';
import { getAvatar } from '../utils/avatar';
import { md5 } from '../utils/hash';
import { verifyPassword } from '../utils/password';
import { generateSecret, verifyTotp } from '../utils/totp';
import { signJwt } from '../jwt';
import {
  getWalineEnv,
  queryString,
  requireUser,
  useWalineUser,
  walineFail,
  walineOk,
} from '../context';

type Envelope = Record<string, unknown>;

/** 与签发的 JWT 有效期保持一致（30 天） */
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** GET /api/token —— 当前登录用户信息 */
export async function currentUserResponse(event: H3Event): Promise<Envelope> {
  const env = getWalineEnv(event);
  const user = useWalineUser(event);
  if (!user) return walineFail(event, 'Unauthorized', 401);

  return walineOk({
    objectId: user.objectId,
    display_name: user.display_name,
    email: user.email,
    type: user.type,
    url: '',
    avatar: user.avatar || (await getAvatar(user.email)),
    label: user.label || '',
    github: user.github,
    twitter: user.twitter,
    facebook: user.facebook,
    google: user.google,
    weibo: user.weibo,
    qq: user.qq,
    '2fa': user['2fa'] ? true : undefined,
    notify_admin_comment: user.notify_admin_comment ?? 1,
    notify_reply: user.notify_reply ?? 1,
    mailMd5: await md5(user.email.toLowerCase()),
  });
}

/** POST /api/token —— 登录（支持两步验证） */
export async function loginResponse(
  event: H3Event,
  body: { email?: string; password?: string; code?: string },
): Promise<Envelope> {
  const env = getWalineEnv(event);
  const { email, password } = body;

  if (!email || !password) {
    return walineFail(event, 'email and password are required', 400);
  }

  const user = await getUserAuthByEmail(env.DB, email);
  if (!user) return walineFail(event, 'Invalid credentials', 401);
  if ((user.type as string) === 'banned') {
    return walineFail(event, 'Invalid credentials', 401);
  }

  const valid = await verifyPassword(password, user.password as string);
  if (!valid) return walineFail(event, 'Invalid credentials', 401);

  // 两步验证
  if (user['2fa']) {
    if (!body.code) {
      return walineFail(event, '2FA required', 401, 1, {
        data: { '2fa': true },
      });
    }
    const verified2fa = await verifyTotp(user['2fa'] as string, body.code);
    if (!verified2fa) {
      return walineFail(
        event,
        'Two factor auth verify failed, please try again',
        401,
      );
    }
  }

  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    return walineFail(event, 'JWT_SECRET not configured', 500);
  }

  const token = await signJwt({ id: user.id as number }, jwtSecret);

  // 供跨域嵌入的评论组件使用（httpOnly，JS 读不到，只能用 storage 里的 token）
  setCookie(event, 'TOKEN', token, {
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
  });

  return walineOk({
    token,
    objectId: user.id,
    display_name: user.display_name,
    email: user.email,
    type: user.type,
    url: '',
    avatar: (user.avatar as string) || (await getAvatar(user.email as string)),
    label: user.label || '',
    mailMd5: await md5((user.email as string).toLowerCase()),
  });
}

/** DELETE /api/token —— 退出登录（清除 Cookie） */
export async function logoutResponse(event: H3Event): Promise<Envelope> {
  setCookie(event, 'TOKEN', '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
  });
  return walineOk();
}

/**
 * GET /api/token/2fa
 *   未登录 + `?email=`：公开查询该邮箱是否开启了两步验证
 *   已登录：返回 otpauth_url + secret（用于绑定身份验证器）
 */
export async function twoFactorStatusResponse(
  event: H3Event,
): Promise<Envelope> {
  const env = getWalineEnv(event);
  const user = useWalineUser(event);
  const email = queryString(event, 'email');

  // 公开检查
  if (!user && email) {
    const row = await getUser2faByEmail(env.DB, email);
    return walineOk({ enable: !!row && !!row['2fa'] });
  }

  if (!user) return walineOk({ enable: false });

  const name = `waline_${user.objectId}`;

  if (user['2fa'] && user['2fa'].length === 32) {
    return walineOk({
      otpauth_url: `otpauth://totp/${name}?secret=${user['2fa']}`,
      secret: user['2fa'],
    });
  }

  const secret = generateSecret(20);
  return walineOk({
    otpauth_url: `otpauth://totp/${name}?secret=${secret}`,
    secret,
  });
}

/** POST /api/token/2fa —— 校验验证码并启用两步验证 */
export async function enableTwoFactorResponse(
  event: H3Event,
  body: { secret?: string; code?: string },
): Promise<Envelope> {
  const env = getWalineEnv(event);
  const user = requireUser(event);

  const { secret, code } = body;
  if (!secret || !code || !/^\d{6}$/.test(code)) {
    return walineFail(event, 'Invalid 2FA code', 400);
  }

  const verified = await verifyTotp(secret, code);
  if (!verified) {
    return walineFail(
      event,
      'Two factor auth verify failed, please try again',
      401,
    );
  }

  await setUser2fa(env.DB, user.objectId, secret);
  return walineOk();
}
