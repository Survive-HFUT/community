import { request, requestEnvelope } from './client';
import type { LoginData, UserInfo } from './types';

/**
 * POST /api/token —— 登录。
 * 账号开启两步验证且未带 code 时，服务端返回 401 且 `data['2fa'] === true`，
 * 客户端把它暴露为 `ApiError.needs2fa`，登录表单据此提示输入动态码。
 */
export async function login(
  email: string,
  password: string,
  code?: string,
): Promise<LoginData> {
  const envelope = await requestEnvelope<{ data: LoginData }>('/token', {
    method: 'POST',
    body: { email, password, code },
  });
  return envelope.data;
}

/** DELETE /api/token —— 退出登录（清除服务端 Cookie；本地 token 由 composable 清理） */
export function logout(): Promise<unknown> {
  return request('/token', { method: 'DELETE' });
}

/** GET /api/token —— 当前登录用户信息 */
export function getUserInfo(): Promise<UserInfo> {
  return request<UserInfo>('/token');
}

/** POST /api/user —— 注册（首个账号自动成为管理员） */
export function register(data: {
  display_name?: string;
  email: string;
  password: string;
  url?: string;
}): Promise<UserInfo> {
  return request<UserInfo>('/user', { method: 'POST', body: data });
}

/** GET /api/token/2fa —— 两步验证绑定信息（otpauth_url + secret） */
export function get2FASetup(): Promise<{
  otpauth_url: string;
  secret: string;
}> {
  return request('/token/2fa');
}

/** POST /api/token/2fa —— 校验动态码并启用两步验证 */
export function verify2FA(secret: string, code: string): Promise<unknown> {
  return request('/token/2fa', { method: 'POST', body: { secret, code } });
}
