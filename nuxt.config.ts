// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  nitro: {
    // Cloudflare Workers + Static Assets。
    // 选中该预设时 Nitro 会把根目录 wrangler.jsonc 合并进 .output/server/wrangler.json，
    // 并在 dev 下用 wrangler 的 getPlatformProxy 注入 event.context.cloudflare.env（真实 D1 绑定）。
    preset: 'cloudflare_module',
    prerender: {
      autoSubfolderIndex: false,
      crawlLinks: true,
      routes: ['/'],
      ignore: [
        '/api',
        '/api/**',
        '/login',
        '/register',
        '/oauth',
        '/profile',
        '/comments',
        '/user',
        '/setting',
        // 旧路径只做 302 重定向，不要被爬虫预渲染成静态页。
        '/ui',
        '/ui/**',
      ],
    },
  },
});
