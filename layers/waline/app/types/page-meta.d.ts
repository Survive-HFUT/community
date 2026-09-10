import type { UserInfo } from '../lib/waline/types';

/**
 * 扩展 Nuxt 的 PageMeta，使后台页面可以声明所需权限。
 * 例如：`definePageMeta({ middleware: 'waline-auth', requiresAdmin: true })`
 */
declare module '#app' {
  interface PageMeta {
    /** 需要 administrator 角色（会先要求登录） */
    requiresAdmin?: boolean;
  }
}

export type { UserInfo };
