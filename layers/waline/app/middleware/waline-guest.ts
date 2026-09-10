/**
 * 仅未登录可见的页面（登录 / 注册 / OAuth 回调）守卫。
 * 已登录用户访问时跳到评论管理，与上游行为一致。
 */
export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return;

  const auth = useWalineAuth();

  // 顺带校验一次 token，过期就地清空，避免被误判为已登录
  if (!auth.user.value && auth.token.value) {
    await auth.init();
  }

  if (auth.isLoggedIn.value) {
    return navigateTo('/comments');
  }
});
