/**
 * 需要登录的路由守卫（替代上游 vue-router 的 `beforeEach`）。
 *
 * 用法：页面里 `definePageMeta({ middleware: 'waline-auth' })`；
 * 需要管理员权限再加 `requiresAdmin: true`。
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // 后台页面都是 routeRules 里的 ssr:false，理论上不会在服务端执行，
  // 这里再兜一层，避免 SSR 阶段访问 localStorage。
  if (import.meta.server) return;

  const auth = useWalineAuth();

  // 有 token 但还没拿到用户资料时，先恢复一次
  if (!auth.user.value && auth.token.value) {
    await auth.init();
  }

  if (!auth.isLoggedIn.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } });
  }

  if (to.meta.requiresAdmin && !auth.isAdmin.value) {
    return navigateTo('/profile');
  }
});
