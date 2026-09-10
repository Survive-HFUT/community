import type { WalineEnv } from '../waline/env';
import { getWalineEnv, getWalinePathname } from '../waline/context';

/**
 * Waline 兼容的 CORS 头 + 版本号头。
 *
 * 上游是 Hono 的 `cors()` + `x-waline-version` 中间件，这里用 Nitro middleware 复刻：
 *   - 只作用于 /api/**
 *   - 支持 OPTIONS 预检（204）
 *   - 允许携带凭证（Waline 客户端需要用 Cookie 会话）
 *   - 暴露 x-waline-version 给 @waline/admin 判断后端版本
 */

const WALINE_VERSION = '1.1.0';

/** 本地开发来源始终放行 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** 允许跨域调用评论接口的站点（含其子域） */
const ALLOWED_DOMAINS = ['survive-hfut.cc'];

function resolveAllowedOrigin(origin: string): string {
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return '';
  }

  const hostname = host.replace(/:\d+$/, '');
  if (LOCAL_HOSTS.has(hostname)) return origin;

  return ALLOWED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))
    ? origin
    : '';
}

export default defineEventHandler((event) => {
  if (!getWalinePathname(event).startsWith('/api/')) return;

  let env: WalineEnv | undefined;
  try {
    env = getWalineEnv(event);
  } catch {
    // 绑定缺失时不要在 CORS 阶段抛错，交给真正的 handler 报错。
    env = undefined;
  }

  const origin = getRequestHeader(event, 'origin');
  if (origin) {
    const allowed = resolveAllowedOrigin(origin);
    if (allowed) {
      setResponseHeaders(event, {
        'Access-Control-Allow-Origin': allowed,
        Vary: 'Origin',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Expose-Headers': 'Content-Length,x-waline-version',
        'Access-Control-Max-Age': '86400',
      });
    }
  }

  // @waline/admin 通过该响应头识别后端版本（导出数据里的 __version）
  setResponseHeader(event, 'x-waline-version', WALINE_VERSION);

  if (getMethod(event) === 'OPTIONS') {
    setResponseStatus(event, 204);
    return null;
  }
});
