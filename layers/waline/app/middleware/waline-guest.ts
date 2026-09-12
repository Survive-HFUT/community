import { isCrossOriginPopup, notifyOpener } from '../lib/waline/notify-opener';

/**
 * 仅未登录可见的页面（登录 / 注册 / OAuth 回调）守卫。
 * 已登录用户访问时跳到评论管理，与上游行为一致。
 *
 * 两个例外（否则「作为 Waline 登录」这条链路会断掉）：
 *  1. URL 上带 `token`（OAuth / 社交登录回调）：必须先让页面处理这个**新** token，
 *     即使本地已存在旧登录态也不能跳走。
 *  2. 评论区登录弹窗（外站 window.open 打开）：已登录时直接把 token 回传给父窗口
 *     并关闭自己，而不是跳到 /comments —— 父页面只认 postMessage，
 *     跳走会让它一直停在「登录中」。
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;

  const auth = useWalineAuth();

  // 顺带校验一次 token，过期就地清空，避免被误判为已登录
  if (!auth.user.value && auth.token.value) {
    await auth.init();
  }

  if (!auth.isLoggedIn.value) return;

  // 1. 回调页自己会用 query 里的 token 重新初始化登录态
  if (to.query.token) return;

  // 2. 弹窗登录：回传 token 后由 notifyOpener 关闭窗口
  if (
    isCrossOriginPopup() &&
    notifyOpener(auth.user.value, auth.token.value, true)
  )
    return;

  return navigateTo('/comments');
});
