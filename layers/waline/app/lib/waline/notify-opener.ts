import type { UserInfo } from './types';

/**
 * Waline 弹窗登录回调（子窗口 → 父窗口）。
 *
 * 协议参考 @waline/api 的 login() 与 @waline/admin 的 store/user.js：
 * 登录成功后向 `window.opener.postMessage({ type: 'userInfo', data: { token, remember, ...user } }, '*')`
 * 并关闭当前弹窗，父页面（Waline 评论组件）据此自动登录。
 *
 * @returns 是否处于弹窗上下文（已通知父窗口并关闭）
 */
export function notifyOpener(
  user: UserInfo | null | undefined,
  token: string,
  remember: boolean,
): boolean {
  if (typeof window !== 'undefined' && window.opener) {
    // 即使资料没拉到也要把 token 发出去，父页面（Waline 评论组件）只依赖 token
    window.opener.postMessage(
      { type: 'userInfo', data: { token, remember, ...(user || {}) } },
      '*',
    );
    window.close();
    return true;
  }
  return false;
}

/** 是否为绝对 URL（Waline 移动端整页跳转时 redirect 参数是父页面完整地址） */
export function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * 是否处于「评论组件登录弹窗」上下文。
 *
 * 仅凭 `window.opener` 判断不够：浏览器里 Ctrl+点击 / `target="_blank"` 打开的新标签
 * 同样带 opener。真正的 Waline 弹窗是**别的站点**（博客）用 `window.open()` 打开的，
 * 所以要求父窗口与当前页面不同源；本站自己打开的窗口仍走普通跳转逻辑。
 */
export function isCrossOriginPopup(): boolean {
  if (typeof window === 'undefined' || !window.opener) return false;

  try {
    const openerLocation = (window.opener as Window).location as
      Location | null | undefined;
    // 父窗口已关闭 / 取不到 location —— 按弹窗处理
    if (!openerLocation) return true;
    return openerLocation.origin !== window.location.origin;
  } catch {
    // 父窗口跨域时读取 location.origin 会抛 SecurityError，正是弹窗场景
    return true;
  }
}
