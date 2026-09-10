import { TOKEN_KEY } from '../lib/waline/client';

/**
 * 启动时恢复登录态。
 *
 * 1. Waline 评论组件以弹窗打开后台时会在 URL 上带 token
 *    （如 `/profile?token=<jwt>`），这里在路由守卫之前写入 sessionStorage。
 *    `/oauth` 除外 —— 它由 OAuth 回调页自行处理 token。
 * 2. 从 localStorage / sessionStorage 把 token 水合进 `useState('waline:token')`。
 * 3. **主动拉取一次用户资料**。这一步很关键：像首页这种没有 `waline-auth`
 *    守卫的页面不会自己调 `init()`，若不在这里预热，`isAdmin` 会一直是 false，
 *    顶栏和首页的管理员入口就会漏掉。
 */
export default defineNuxtPlugin(() => {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');

  if (urlToken && !window.location.pathname.startsWith('/oauth')) {
    sessionStorage.setItem(TOKEN_KEY, urlToken);
  }

  const auth = useWalineAuth();
  auth.restoreFromStorage();

  // 不阻塞首屏：token 同步恢复后 `isLoggedIn` 立即可用，
  // 资料到达后 `isAdmin` 会自动刷新。
  if (auth.token.value) {
    void auth.init();
  }
});
