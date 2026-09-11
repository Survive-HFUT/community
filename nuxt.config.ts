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
        name: 'community',
        compatibility_flags: ['nodejs_compat', 'no_nodejs_compat_v2'],

        d1_databases: [
          {
            binding: 'DB',
            database_name: 'waline-db',
            database_id: '43359dbd-a17b-4549-ad08-5bbc5dcc489a',
          },
        ],

        assets: {
          directory: './output/public',
          binding: 'ASSETS',
          not_found_handling: 'single-page-application',
          run_worker_first: ['/api/**'],
        },

        routes: [
          {
            pattern: 'community.survive-hfut.cc',
            custom_domain: true,
          },
        ],
        workers_dev: false,
        preview_urls: false,
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
        // 旧路径只做 302 重定向，不要被爬虫预渲染成静态页。
        '/ui',
        '/ui/**',
      ],
    },
  },
});
