// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  nitro: {
    preset: 'cloudflare_module',
    cloudflare: {
      deployConfig: true,

      wrangler: {
        assets: {
          run_worker_first: true,
        },
      },
    },

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
        // 选修课评价页面都是 ssr:false（打分页还要求登录），预渲染只会得到空壳；
        // 运行时由 Worker 直接返回 SPA 外壳（assets.run_worker_first: true）。
        '/electives',
        '/electives/**',
        // 旧路径只做 302 重定向，不要被爬虫预渲染成静态页。
        '/ui',
        '/ui/**',
      ],
    },
  },
});
