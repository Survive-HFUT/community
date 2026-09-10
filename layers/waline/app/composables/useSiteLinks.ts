/**
 * 站点导航注册表 —— 让「新 layer」无需修改本 layer 就能往顶栏 / 首页添加入口。
 *
 * ## 用法（在任意 layer 里新增一个 plugin）
 *
 * ```ts
 * // layers/<你的功能>/app/plugins/site-links.ts
 * export default defineNuxtPlugin(() => {
 *   registerSiteLinks({
 *     to: '/threads',
 *     label: '讨论区',
 *     icon: 'i-lucide-messages-square',
 *     description: '发帖、回帖与订阅通知',
 *     // 默认 'both'，同时出现在 header 与首页
 *     // scope: 'header' | 'home' | 'both'
 *     requiresAuth: true,
 *     order: 50,
 *   })
 * })
 * ```
 *
 * 之所以用「注册表 + plugin」而不是让新 layer 直接改 `AppNavbar.vue`：
 *   - layer 是叠加的，新 layer 不应该去 patch 别人的文件；
 *   - 删除新 layer 时入口会自动消失，不会留下死链接；
 *   - 权限过滤（requiresAuth / requiresAdmin）统一在这里做。
 *
 * 说明：注册发生在 Nuxt plugin 阶段（早于首屏渲染），注册内容对所有请求都一样，
 * 所以用模块级数组即可，不需要 useNuxtApp / useState。
 */

export interface SiteLink {
  /** 目标路由 */
  to: string;
  /** 顶栏与首页卡片显示的文案 */
  label: string;
  /**
   * Iconify 图标名，例如 `i-lucide-newspaper`。
   * 需要对应的 `@iconify-json/*` 已安装，否则会走远程 API。
   */
  icon?: string;
  /** 首页卡片的一句话描述；不填则首页只显示标题 */
  description?: string;
  /** 展示位置，默认 `both`（顶栏 + 首页） */
  scope?: 'header' | 'home' | 'both';
  /** 仅登录用户可见 */
  requiresAuth?: boolean;
  /** 仅管理员可见（隐含 requiresAuth） */
  requiresAdmin?: boolean;
  /** 排序权重，越小越靠前，默认 100 */
  order?: number;
}

/** 模块级注册表；plugin 阶段写入，渲染阶段只读 */
const registry: SiteLink[] = [];

/**
 * 注册站点入口。可在多个 plugin 里重复调用。
 * 相同 `to` 只保留第一次注册的结果（避免 dev 下 HMR 重复注册）。
 */
export function registerSiteLinks(...links: SiteLink[]): void {
  for (const link of links) {
    if (!link?.to || !link?.label) continue;
    if (registry.some((item) => item.to === link.to)) continue;
    registry.push(link);
  }
}

/**
 * 读取当前用户可见的入口列表。
 * 会自动按登录态 / 管理员身份过滤，并按 `order` 排序。
 */
export function useSiteLinks(scope: 'header' | 'home') {
  const auth = useWalineAuth();

  return computed(() =>
    registry
      .filter((link) => {
        const target = link.scope ?? 'both';
        return target === 'both' || target === scope;
      })
      .filter((link) => !link.requiresAdmin || auth.isAdmin.value)
      .filter((link) => !link.requiresAuth || auth.isLoggedIn.value)
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100)),
  );
}
