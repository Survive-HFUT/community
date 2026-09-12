import { getUserInfo, logout as logoutRequest } from '../lib/waline/auth';
import {
  clearStoredToken,
  readStoredToken,
  writeStoredToken,
} from '../lib/waline/client';
import type { UserInfo } from '../lib/waline/types';

/**
 * 进行中的资料请求。多处（启动插件、路由守卫、页面）都可能在首屏同时要求
 * 恢复登录态，共用同一个 Promise 可以避免重复打 /api/token。
 *
 * `inflightToken` 记录这个请求用的是哪个 token：token 一旦被替换（例如 OAuth
 * 回调页刚写入新 token），旧的请求就作废 —— 否则会被它的失败结果误清空，
 * 表现就是「OAuth 回来后必须手动刷新才登录得上」。
 */
let inflight: Promise<void> | null = null;
let inflightToken = '';

/**
 * Waline 登录态。
 *
 * 上游用 Pinia store 实现；这里改成 Nuxt 惯用的「`useState` 共享状态 + composable」，
 * 行为保持一致：
 *   - token 同时存内存状态与 localStorage/sessionStorage（键名 TOKEN，兼容 @waline/admin）
 *   - `isLoggedIn` 只看 token 是否存在；`isAdmin` 看用户 type
 *   - `init()` 拉取用户资料，失败则清空登录态
 */
export function useWalineAuth() {
  const token = useState<string>('waline:token', () => '');
  const user = useState<UserInfo | null>('waline:user', () => null);
  const loading = useState<boolean>('waline:auth-loading', () => false);

  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.type === 'administrator');

  /** 用 token 换取用户资料；失败说明 token 已失效，清空登录态 */
  async function init(): Promise<void> {
    if (!token.value) return;
    if (inflight && inflightToken === token.value) return inflight;

    const requestToken = token.value;
    loading.value = true;
    inflightToken = requestToken;
    inflight = (async () => {
      try {
        const info = await getUserInfo();
        // 期间 token 已被替换（如 OAuth 回调写入新 token）→ 丢弃本次结果
        if (token.value !== requestToken) return;
        user.value = info;
      } catch {
        if (token.value === requestToken) clear();
      } finally {
        if (inflightToken === requestToken) {
          loading.value = false;
          inflight = null;
        }
      }
    })();

    return inflight;
  }

  /** 登录成功后：先持久化 token，再拉取资料 */
  async function login(nextToken: string, remember: boolean): Promise<void> {
    setToken(nextToken, remember);
    await init();
  }

  function setToken(nextToken: string, remember: boolean): void {
    // 换了 token 就等于换了账号，先把上一位用户的资料清掉，避免短暂显示错人
    if (nextToken !== token.value) user.value = null;
    token.value = nextToken;
    writeStoredToken(nextToken, remember);
  }

  /** 退出登录：通知服务端清 Cookie（失败可忽略），并清空本地状态 */
  function logout(): void {
    void Promise.resolve(logoutRequest()).catch(() => {});
    clear();
  }

  function clear(): void {
    token.value = '';
    user.value = null;
    clearStoredToken();
  }

  /** 从本地存储恢复 token（由 plugins/waline-token.client.ts 在启动时调用） */
  function restoreFromStorage(): void {
    token.value = readStoredToken();
  }

  return {
    token,
    user,
    loading,
    isLoggedIn,
    isAdmin,
    init,
    login,
    setToken,
    logout,
    clear,
    restoreFromStorage,
  };
}
