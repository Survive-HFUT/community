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
  user: UserInfo,
  token: string,
  remember: boolean,
): boolean {
  if (typeof window !== 'undefined' && window.opener) {
    window.opener.postMessage(
      { type: 'userInfo', data: { token, remember, ...user } },
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
