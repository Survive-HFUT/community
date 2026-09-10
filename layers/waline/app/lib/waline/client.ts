import { $fetch } from '#imports';

/**
 * Waline API 客户端。
 *
 * - 信封格式：`{ errno, errmsg, data, ... }`，`errno !== 0` 一律抛出 ApiError
 * - token 存储键名与 @waline/admin 约定一致：`TOKEN`（localStorage / sessionStorage）
 */

export const TOKEN_KEY = 'TOKEN';

export class ApiError extends Error {
  errno: number;
  status: number;
  /** 登录时服务端提示需要两步验证时为 true */
  needs2fa?: boolean;

  constructor(message: string, errno: number, status: number) {
    super(message);
    this.name = 'ApiError';
    this.errno = errno;
    this.status = status;
  }
}

/** 读取本地 token（sessionStorage 优先，其次 localStorage） */
export function readStoredToken(): string {
  if (typeof window === 'undefined') return '';
  return (
    sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ''
  );
}

/** 写入 token；`remember` 决定放 localStorage（30 天）还是 sessionStorage */
export function writeStoredToken(token: string, remember: boolean): void {
  if (typeof window === 'undefined') return;
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
}

/** 清空本地 token */
export function clearStoredToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** 额外请求头 */
  headers?: Record<string, string>;
}

/** 把服务端返回的载荷/状态码转成 ApiError（识别 2FA 提示） */
function toApiError(payload: any, status: number, fallback: string): ApiError {
  const error = new ApiError(
    payload?.errmsg || fallback,
    payload?.errno ?? 1,
    status,
  );
  if (payload?.data?.['2fa']) error.needs2fa = true;
  return error;
}

/** 基础客户端：自动附加 Bearer token 并解包信封 */
const client = $fetch.create({
  baseURL: '/api',
  timeout: 15000,
  onRequest({ options }) {
    const token = readStoredToken();
    if (token) {
      options.headers.set('Authorization', `Bearer ${token}`);
    }
  },
  onResponse({ response }) {
    const payload = response._data;
    if (
      payload &&
      typeof payload === 'object' &&
      'errno' in payload &&
      (payload as { errno: number }).errno !== 0
    ) {
      throw toApiError(payload, response.status, 'Request failed');
    }
  },
  onResponseError({ response, error }) {
    throw toApiError(
      response?._data,
      response?.status ?? 0,
      (error as Error)?.message || 'Request failed',
    );
  },
});

/** 执行请求并返回完整信封（失败抛 ApiError） */
export async function requestEnvelope<T = any>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return (await client(path, {
    method: options.method ?? 'GET',
    body: options.body as never,
    query: options.query,
    headers: options.headers,
  })) as T;
}

/** 执行请求并解出信封里的 `data` */
export async function request<T = any>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const envelope = await requestEnvelope<{ data?: T }>(path, options);
  return (envelope?.data ?? envelope) as T;
}
