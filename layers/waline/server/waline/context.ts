import type { WalineEnv, WalineUser } from './env';

/**
 * 业务层可抛出的错误，会被 walineHandler 转成 Waline 的 `{ errno, errmsg, data }` 信封。
 * 对应上游 Hono 实现里 `c.json({ errno, errmsg }, status)` 的分支。
 */
export class WalineError extends Error {
  errno: number;
  statusCode: number;
  data?: unknown;

  constructor(errmsg: string, statusCode = 400, errno = 1, data?: unknown) {
    super(errmsg);
    this.name = 'WalineError';
    this.errno = errno;
    this.statusCode = statusCode;
    this.data = data;
  }
}

/** 请求路径（不含 query），用于 middleware 里做前缀判断 */
export function getWalinePathname(event: H3Event): string {
  return getRequestURL(event).pathname;
}

/**
 * 取 Cloudflare 绑定。
 *
 * dev 与生产都由 Nitro 的 cloudflare 预设注入 `event.context.cloudflare.env`：
 *   - dev：wrangler 的 getPlatformProxy 读取根目录 wrangler.jsonc + .dev.vars
 *   - 生产：Workers 运行时传入的 env
 */
export function getWalineEnv(event: H3Event): WalineEnv {
  const env = (event.context.cloudflare as { env?: WalineEnv } | undefined)
    ?.env;

  if (!env) {
    throw new WalineError(
      'Cloudflare bindings unavailable. Install `wrangler` (devDependency) and make sure wrangler.jsonc declares the D1 binding.',
      500,
    );
  }
  if (!env.DB) {
    throw new WalineError(
      'D1 binding `DB` is missing. Check `d1_databases` in wrangler.jsonc.',
      500,
    );
  }
  return env;
}

/** 当前登录用户（未登录为 undefined）。由 middleware/01.waline-auth.ts 写入。 */
export function useWalineUser(event: H3Event): WalineUser | undefined {
  return event.context.walineUser as WalineUser | undefined;
}

export function requireUser(event: H3Event): WalineUser {
  const user = useWalineUser(event);
  if (!user) throw new WalineError('Unauthorized', 401);
  return user;
}

export function requireAdmin(event: H3Event): WalineUser {
  const user = useWalineUser(event);
  if (!user) throw new WalineError('Unauthorized', 401);
  if (user.type !== 'administrator') throw new WalineError('Forbidden', 403);
  return user;
}

/** 取客户端 IP（Cloudflare 会在边缘注入 CF-Connecting-IP） */
export function getWalineIp(event: H3Event): string {
  return getRequestHeader(event, 'cf-connecting-ip') || '';
}

// ---------- query 取值辅助（替代 Hono 的 c.req.query / c.req.queries） ----------

/** 取单个 query 值；重复参数只取第一个 */
export function queryString(event: H3Event, key: string): string {
  const value = getQuery(event)[key];
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
  return typeof value === 'string' ? value : '';
}

/** 按顺序尝试多个 key，返回重复参数数组（对应 c.req.queries('path') || c.req.queries('path[]')） */
export function queryArray(event: H3Event, ...keys: string[]): string[] {
  const query = getQuery(event);
  for (const key of keys) {
    const value = query[key];
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string');
    }
    if (typeof value === 'string' && value) return [value];
  }
  return [];
}

/** 解析整数 query，非法值回退到 fallback */
export function queryInt(
  event: H3Event,
  key: string,
  fallback: number,
): number {
  const parsed = parseInt(queryString(event, key), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// ---------- 异步任务 ----------

/**
 * 复刻上游 `c.executionCtx.waitUntil` 的语义：登记一个不阻塞响应的后台任务。
 *
 * Nitro 的 cloudflare 预设（生产）与 dev 插件都会在 `event.context.waitUntil` 上
 * 挂一个已绑定 this 的函数；这里再做一层兜底，保证在拿不到时也不会抛错。
 */
export function walineWaitUntil(event: H3Event, task: Promise<unknown>): void {
  const direct = event.context.waitUntil as
    ((promise: Promise<unknown>) => void) | undefined;
  if (typeof direct === 'function') {
    direct(task);
    return;
  }

  const cf = event.context.cloudflare as
    | { context?: { waitUntil?: (promise: Promise<unknown>) => void } }
    | undefined;
  if (typeof cf?.context?.waitUntil === 'function') {
    cf.context.waitUntil(task);
    return;
  }

  // 本地纯 Node 环境降级为 fire-and-forget，至少不丢任务。
  void task;
}

/** 统一成功信封：`{ errno: 0, errmsg: '', data }` */
export function walineOk<T>(data?: T): { errno: 0; errmsg: string; data?: T } {
  return data === undefined
    ? { errno: 0, errmsg: '' }
    : { errno: 0, errmsg: '', data };
}

/** 统一失败信封：`{ errno, errmsg, ...extra }`，并设置 HTTP 状态码 */
export function walineFail(
  event: H3Event,
  errmsg: string,
  statusCode = 400,
  errno = 1,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  setResponseStatus(event, statusCode);
  return { errno, errmsg, ...extra };
}

/**
 * 把 handler 的异常转换为 Waline 信封，替代上游 Hono 的 `app.onError`：
 *   - WalineError         → 自带 status / errno / errmsg
 *   - 请求体 JSON 解析失败 → 400 `Invalid JSON body`
 *   - 其它 4xx            → 原状态码 + 原始 message
 *   - 其它                → 500 `Internal Server Error`（同时打日志）
 */
export function walineHandler<T>(handler: (event: H3Event) => T | Promise<T>) {
  return defineEventHandler(async (event) => {
    try {
      return await handler(event);
    } catch (error: unknown) {
      if (error instanceof WalineError) {
        setResponseStatus(event, error.statusCode);
        return {
          errno: error.errno,
          errmsg: error.message,
          ...(error.data === undefined ? {} : { data: error.data }),
        };
      }

      const err = error as {
        statusCode?: number;
        status?: number;
        message?: string;
      };
      const status =
        typeof err?.statusCode === 'number'
          ? err.statusCode
          : typeof err?.status === 'number'
            ? err.status
            : 500;

      // readBody 对畸形 JSON 会抛 400，上游同样回 'Invalid JSON body'
      if (status === 400) {
        return walineFail(event, 'Invalid JSON body', 400);
      }

      if (status >= 400 && status < 500) {
        return walineFail(event, err?.message || 'Request failed', status);
      }

      console.error('[waline] Unhandled Error', err?.message || error);
      return walineFail(event, 'Internal Server Error', 500);
    }
  });
}
