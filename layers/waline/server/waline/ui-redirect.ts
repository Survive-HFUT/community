/**
 * 旧地址兼容层：上游把管理后台挂在 `/ui/*` 下，本项目已改为不带前缀的路径
 * （`/login`、`/comments` …）。这里保留 302 重定向，让
 *   - 已部署的 @waline/client 评论组件（弹窗登录指向 `/ui/login`）
 *   - 用户书签 / 外部链接
 * 都能继续工作，并且**完整保留 query string**（`?token=`、`?redirect=`、`?error=`）。
 */

/** 精确映射：旧路径 → 新路径 */
const EXACT: Record<string, string> = {
  '/ui': '/',
  '/ui/login': '/login',
  '/ui/register': '/register',
  '/ui/oauth': '/oauth',
  '/ui/profile': '/profile',
  '/ui/dashboard': '/',
  '/ui/comments': '/comments',
  '/ui/user': '/user',
  '/ui/setting': '/setting',
};

/** 解析旧路径对应的新路径 */
export function resolveUiRedirect(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '') || '/ui';

  const exact = EXACT[normalized];
  if (exact) return exact;

  // 其它未知的 /ui/* 一律回到登录页
  if (normalized.startsWith('/ui/')) return '/login';

  return '/';
}

/** `/ui` 与 `/ui/**` 共用的重定向 handler */
export function uiRedirectHandler(event: H3Event): unknown {
  const url = getRequestURL(event);
  const target = resolveUiRedirect(url.pathname);
  // url.search 自带 '?'，直接拼接即可保留原始查询参数
  return sendRedirect(event, `${target}${url.search}`, 302);
}
