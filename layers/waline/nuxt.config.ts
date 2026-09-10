import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

/**
 * Waline 评论系统 layer。
 *
 * 提供：
 *   - 后端：/api/comment /api/user /api/token /api/settings /api/oauth /api/db
 *   - 后台页面：/login /register /oauth /profile /comments /user /setting
 *   - 兼容旧地址：/ui/** 一律 302 到上述新地址
 *
 * 数据库：Cloudflare D1（绑定名 DB），通过 event.context.cloudflare.env.DB 访问。
 */
export default defineNuxtConfig({
  // 「主题定制入口」：品牌色、圆角、内容宽度都在这个文件里，改它即可换肤。
  // layer 内的相对路径必须以绝对路径注入，否则会被解析到用户项目根目录。
  css: [join(currentDir, 'app/assets/css/theme.css')],

  // 深色模式默认跟随系统，用户可在顶栏手动切换（ThemeToggle）。
  // Nuxt UI 自带 @nuxtjs/color-mode，这里的配置会透传给该模块。
  colorMode: {
    preference: 'system',
    fallback: 'light',
    classSuffix: '',
    storageKey: 'community-color-mode',
  },

  routeRules: {
    // 后台页面依赖 localStorage / sessionStorage 保存 JWT（@waline/admin 约定），
    // 只能在浏览器端渲染，因此对整条路由关闭 SSR。
    '/login': { ssr: false },
    '/register': { ssr: false },
    '/oauth': { ssr: false },
    '/profile': { ssr: false },
    '/comments': { ssr: false },
    '/user': { ssr: false },
    '/setting': { ssr: false },
  },
});
